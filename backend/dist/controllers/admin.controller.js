"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdminUsers = listAdminUsers;
exports.createAdminUser = createAdminUser;
exports.updateAdminUserRole = updateAdminUserRole;
const crypto_1 = require("crypto");
const pg_1 = require("pg");
const zod_1 = require("zod");
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const env_1 = __importDefault(require("../config/env"));
const { AppError } = require("../middleware/errorHandler");
let pool = null;
let cognitoClient = null;
function getPool() {
    if (pool) {
        return pool;
    }
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new AppError("Missing required environment variable: DATABASE_URL", 500);
    }
    pool = new pg_1.Pool({
        connectionString,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : true,
    });
    return pool;
}
function getCognitoClient() {
    if (cognitoClient) {
        return cognitoClient;
    }
    cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({ region: env_1.default.awsRegion });
    return cognitoClient;
}
const adminUserRoleSchema = zod_1.z.enum(["REQUESTER", "PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"]);
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    name: zod_1.z.string().min(1),
    role: adminUserRoleSchema,
    temporaryPassword: zod_1.z.string().min(8).max(128).optional(),
    ministryId: zod_1.z.string().min(1).nullable().optional(),
});
const updateRoleSchema = zod_1.z.object({
    role: adminUserRoleSchema,
});
const knownRoles = ["REQUESTER", "PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"];
function mapRow(row) {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        ministryId: row.ministryId ?? null,
        ministryName: row.ministry_name ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
function generateTemporaryPassword() {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()-_=+[]{}";
    const alphabet = `${uppercase}${lowercase}${numbers}${symbols}`;
    const pick = (source) => source[(0, crypto_1.randomBytes)(1)[0] % source.length];
    const chars = [pick(uppercase), pick(lowercase), pick(numbers), pick(symbols)];
    while (chars.length < 12) {
        chars.push(pick(alphabet));
    }
    return chars.sort(() => Math.random() - 0.5).join("");
}
async function syncCognitoRole(email, nextRole) {
    const client = getCognitoClient();
    const groupsResult = await client.send(new client_cognito_identity_provider_1.AdminListGroupsForUserCommand({
        UserPoolId: env_1.default.cognitoUserPoolId,
        Username: email,
    }));
    for (const group of groupsResult.Groups ?? []) {
        if (group.GroupName && knownRoles.includes(group.GroupName) && group.GroupName !== nextRole) {
            await client.send(new client_cognito_identity_provider_1.AdminRemoveUserFromGroupCommand({
                UserPoolId: env_1.default.cognitoUserPoolId,
                Username: email,
                GroupName: group.GroupName,
            }));
        }
    }
    await client.send(new client_cognito_identity_provider_1.AdminAddUserToGroupCommand({
        UserPoolId: env_1.default.cognitoUserPoolId,
        Username: email,
        GroupName: nextRole,
    }));
}
async function deleteCognitoUser(email) {
    try {
        await getCognitoClient().send(new client_cognito_identity_provider_1.AdminDeleteUserCommand({
            UserPoolId: env_1.default.cognitoUserPoolId,
            Username: email,
        }));
    }
    catch (error) {
        console.error(`Failed to roll back Cognito user for ${email}:`, error);
    }
}
async function listAdminUsers(req, res, next) {
    const client = await getPool().connect();
    try {
        if (!req.user) {
            throw new AppError("Unauthorized", 401);
        }
        const usersResult = await client.query(`SELECT
				u.id,
				u.email,
				u.name,
				u.role,
				u."ministryId",
				u."createdAt",
				u."updatedAt",
				m.name AS ministry_name
			 FROM "User" u
			 LEFT JOIN "Ministry" m ON u."ministryId" = m.id
			 ORDER BY u."createdAt" DESC, u.name ASC`);
        return res.json({
            users: usersResult.rows.map(mapRow),
        });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
async function createAdminUser(req, res, next) {
    const client = await getPool().connect();
    let cognitoUserCreated = false;
    try {
        if (!req.user) {
            throw new AppError("Unauthorized", 401);
        }
        const parsed = createUserSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new AppError(`Invalid user payload: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`, 400);
        }
        const { email, name, role, ministryId } = parsed.data;
        const temporaryPassword = parsed.data.temporaryPassword?.trim() || generateTemporaryPassword();
        const existingUser = await client.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
        if (existingUser.rows.length > 0) {
            throw new AppError("A user with that email already exists", 409);
        }
        await getCognitoClient().send(new client_cognito_identity_provider_1.AdminCreateUserCommand({
            UserPoolId: env_1.default.cognitoUserPoolId,
            Username: email,
            TemporaryPassword: temporaryPassword,
            MessageAction: "SUPPRESS",
            DesiredDeliveryMediums: ["EMAIL"],
            UserAttributes: [
                { Name: "email", Value: email },
                { Name: "name", Value: name },
                { Name: "email_verified", Value: "true" },
            ],
        }));
        cognitoUserCreated = true;
        try {
            await syncCognitoRole(email, role);
        }
        catch (error) {
            await deleteCognitoUser(email);
            throw error;
        }
        await client.query(`INSERT INTO "User" (id, email, name, role, "ministryId", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`, [(0, crypto_1.randomUUID)(), email, name, role, ministryId ?? null]);
        const createdUserResult = await client.query(`SELECT
				u.id,
				u.email,
				u.name,
				u.role,
				u."ministryId",
				u."createdAt",
				u."updatedAt",
				m.name AS ministry_name
			 FROM "User" u
			 LEFT JOIN "Ministry" m ON u."ministryId" = m.id
			 WHERE u.email = $1`, [email]);
        return res.status(201).json({
            user: mapRow(createdUserResult.rows[0]),
            temporaryPassword,
        });
    }
    catch (error) {
        if (req.body?.email && cognitoUserCreated) {
            await deleteCognitoUser(req.body.email);
        }
        return next(error);
    }
    finally {
        client.release();
    }
}
async function updateAdminUserRole(req, res, next) {
    const client = await getPool().connect();
    try {
        if (!req.user) {
            throw new AppError("Unauthorized", 401);
        }
        const parsedParams = zod_1.z.object({ id: zod_1.z.string().min(1) }).safeParse(req.params);
        if (!parsedParams.success) {
            throw new AppError("Invalid user id", 400);
        }
        const parsedBody = updateRoleSchema.safeParse(req.body);
        if (!parsedBody.success) {
            throw new AppError(`Invalid user payload: ${parsedBody.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`, 400);
        }
        const userResult = await client.query(`SELECT id, email, role FROM "User" WHERE id = $1`, [parsedParams.data.id]);
        if (userResult.rows.length === 0) {
            throw new AppError("User not found", 404);
        }
        const user = userResult.rows[0];
        const nextRole = parsedBody.data.role;
        if (user.role !== nextRole) {
            await syncCognitoRole(user.email, nextRole);
        }
        try {
            await client.query(`UPDATE "User"
				 SET role = $1, "updatedAt" = NOW()
				 WHERE id = $2`, [nextRole, user.id]);
        }
        catch (error) {
            if (user.role !== nextRole) {
                await syncCognitoRole(user.email, user.role);
            }
            throw error;
        }
        const updatedResult = await client.query(`SELECT
				u.id,
				u.email,
				u.name,
				u.role,
				u."ministryId",
				u."createdAt",
				u."updatedAt",
				m.name AS ministry_name
			 FROM "User" u
			 LEFT JOIN "Ministry" m ON u."ministryId" = m.id
			 WHERE u.id = $1`, [user.id]);
        return res.json({ user: mapRow(updatedResult.rows[0]) });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
exports.default = {
    listAdminUsers,
    createAdminUser,
    updateAdminUserRole,
};
//# sourceMappingURL=admin.controller.js.map