import type { NextFunction, Request, Response } from "express";
import { randomBytes, randomUUID } from "crypto";
import { Pool } from "pg";
import { z } from "zod";
import {
	AdminAddUserToGroupCommand,
	AdminCreateUserCommand,
	AdminInitiateAuthCommand,
	AdminDeleteUserCommand,
	AdminListGroupsForUserCommand,
	AdminRemoveUserFromGroupCommand,
	CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

import config from "../config/env";
const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

type AdminUserRole = "REQUESTER" | "PARISH_SECRETARY" | "PARISH_PRIEST" | "ADMIN";

type UserRow = {
	id: string;
	email: string;
	name: string;
	role: AdminUserRole;
	ministryId: string | null;
	ministryName: string | null;
	createdAt: string;
	updatedAt: string;
};

type AdminUserRecord = {
	id: string;
	email: string;
	name: string;
	role: AdminUserRole;
	ministryId: string | null;
	ministryName: string | null;
	createdAt: string;
	updatedAt: string;
};

let pool: Pool | null = null;
let cognitoClient: CognitoIdentityProviderClient | null = null;

function getPool(): Pool {
	if (pool) {
		return pool;
	}

	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new AppError("Missing required environment variable: DATABASE_URL", 500);
	}

	pool = new Pool({
		connectionString,
		ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : true,
	});

	return pool;
}

function getCognitoClient(): CognitoIdentityProviderClient {
	if (cognitoClient) {
		return cognitoClient;
	}

	cognitoClient = new CognitoIdentityProviderClient({ region: config.awsRegion });
	return cognitoClient;
}

const adminUserRoleSchema = z.enum(["REQUESTER", "PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"]);

const createUserSchema = z.object({
	email: z.string().email(),
	name: z.string().min(1),
	role: adminUserRoleSchema,
	temporaryPassword: z.string().min(8).max(128).optional(),
	ministryId: z.string().min(1).nullable().optional(),
});

const updateRoleSchema = z.object({
	role: adminUserRoleSchema,
});

const deleteUserSchema = z.object({
	password: z.string().min(1).max(256),
});

const knownRoles: AdminUserRole[] = ["REQUESTER", "PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"];

function mapRow(row: Record<string, any>): AdminUserRecord {
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

function generateTemporaryPassword(): string {
	const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const lowercase = "abcdefghijklmnopqrstuvwxyz";
	const numbers = "0123456789";
	const symbols = "!@#$%^&*()-_=+[]{}";
	const alphabet = `${uppercase}${lowercase}${numbers}${symbols}`;

	const pick = (source: string) => source[randomBytes(1)[0] % source.length];
	const chars = [pick(uppercase), pick(lowercase), pick(numbers), pick(symbols)];

	while (chars.length < 12) {
		chars.push(pick(alphabet));
	}

	return chars.sort(() => Math.random() - 0.5).join("");
}

async function syncCognitoRole(email: string, nextRole: AdminUserRole) {
	const client = getCognitoClient();

	const groupsResult = await client.send(
		new AdminListGroupsForUserCommand({
			UserPoolId: config.cognitoUserPoolId,
			Username: email,
		}),
	);

	for (const group of groupsResult.Groups ?? []) {
		if (group.GroupName && knownRoles.includes(group.GroupName as AdminUserRole) && group.GroupName !== nextRole) {
			await client.send(
				new AdminRemoveUserFromGroupCommand({
					UserPoolId: config.cognitoUserPoolId,
					Username: email,
					GroupName: group.GroupName,
				}),
			);
		}
	}

	await client.send(
		new AdminAddUserToGroupCommand({
			UserPoolId: config.cognitoUserPoolId,
			Username: email,
			GroupName: nextRole,
		}),
	);
}

async function deleteCognitoUser(email: string) {
	try {
		await getCognitoClient().send(
			new AdminDeleteUserCommand({
				UserPoolId: config.cognitoUserPoolId,
				Username: email,
			}),
		);
	} catch (error) {
		console.error(`Failed to roll back Cognito user for ${email}:`, error);
	}
}

async function verifyAdminPassword(email: string, password: string) {
	try {
		await getCognitoClient().send(
			new AdminInitiateAuthCommand({
				UserPoolId: config.cognitoUserPoolId,
				ClientId: config.cognitoClientId,
				AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
				AuthParameters: {
					USERNAME: email,
					PASSWORD: password,
				},
			}),
		);
	} catch (error: any) {
		if (error?.name === "NotAuthorizedException" || error?.name === "UserNotFoundException") {
			throw new AppError("Invalid password", 401);
		}

		throw error;
	}
}

async function getDeleteUsageCounts(client: any, userId: string) {
	const result = await client.query(
		`SELECT
			(SELECT COUNT(*)::int FROM "VenueRequest" WHERE "requesterId" = $1) AS requester_count,
			(SELECT COUNT(*)::int FROM "VenueRequest" WHERE "currentApproverId" = $1) AS current_approver_count,
			(SELECT COUNT(*)::int FROM "ApprovalAction" WHERE "approverId" = $1) AS approval_action_count,
			(SELECT COUNT(*)::int FROM "AuditLog" WHERE "performedById" = $1) AS audit_log_count
		 FROM (SELECT 1) AS counts`,
		[userId],
	);

	return result.rows[0] as {
		requester_count: number;
		current_approver_count: number;
		approval_action_count: number;
		audit_log_count: number;
	};
}

export async function listAdminUsers(req: Request, res: Response, next: NextFunction) {
	const client = await getPool().connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const usersResult = await client.query(
			`SELECT
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
			 ORDER BY u."createdAt" DESC, u.name ASC`,
		);

		return res.json({
			users: usersResult.rows.map(mapRow),
		});
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function createAdminUser(req: Request, res: Response, next: NextFunction) {
	const client = await getPool().connect();
	let cognitoUserCreated = false;
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const parsed = createUserSchema.safeParse(req.body);
		if (!parsed.success) {
			throw new AppError(
				`Invalid user payload: ${parsed.error.issues.map((issue: any) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`,
				400,
			);
		}

		const { email, name, role, ministryId } = parsed.data;
		const temporaryPassword = parsed.data.temporaryPassword?.trim() || generateTemporaryPassword();

		const existingUser = await client.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
		if (existingUser.rows.length > 0) {
			throw new AppError("A user with that email already exists", 409);
		}

		await getCognitoClient().send(
			new AdminCreateUserCommand({
				UserPoolId: config.cognitoUserPoolId,
				Username: email,
				TemporaryPassword: temporaryPassword,
				MessageAction: "SUPPRESS",
				DesiredDeliveryMediums: ["EMAIL"],
				UserAttributes: [
					{ Name: "email", Value: email },
					{ Name: "name", Value: name },
					{ Name: "email_verified", Value: "true" },
				],
			}),
		);
		cognitoUserCreated = true;

		try {
			await syncCognitoRole(email, role);
		} catch (error) {
			await deleteCognitoUser(email);
			throw error;
		}

		await client.query(
			`INSERT INTO "User" (id, email, name, role, "ministryId", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
			[randomUUID(), email, name, role, ministryId ?? null],
		);

		const createdUserResult = await client.query(
			`SELECT
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
			 WHERE u.email = $1`,
			[email],
		);

		return res.status(201).json({
			user: mapRow(createdUserResult.rows[0]),
			temporaryPassword,
		});
	} catch (error) {
		if (req.body?.email && cognitoUserCreated) {
			await deleteCognitoUser(req.body.email);
		}
		return next(error);
	} finally {
		client.release();
	}
}

export async function updateAdminUserRole(req: Request, res: Response, next: NextFunction) {
	const client = await getPool().connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const parsedParams = z.object({ id: z.string().min(1) }).safeParse(req.params);
		if (!parsedParams.success) {
			throw new AppError("Invalid user id", 400);
		}

		const parsedBody = updateRoleSchema.safeParse(req.body);
		if (!parsedBody.success) {
			throw new AppError(
				`Invalid user payload: ${parsedBody.error.issues.map((issue: any) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`,
				400,
			);
		}

		const userResult = await client.query(
			`SELECT id, email, role FROM "User" WHERE id = $1`,
			[parsedParams.data.id],
		);

		if (userResult.rows.length === 0) {
			throw new AppError("User not found", 404);
		}

		const user = userResult.rows[0] as { id: string; email: string; role: AdminUserRole };
		const nextRole = parsedBody.data.role;

		if (user.role !== nextRole) {
			await syncCognitoRole(user.email, nextRole);
		}

		try {
			await client.query(
				`UPDATE "User"
				 SET role = $1, "updatedAt" = NOW()
				 WHERE id = $2`,
				[nextRole, user.id],
			);
		} catch (error) {
			if (user.role !== nextRole) {
				await syncCognitoRole(user.email, user.role);
			}
			throw error;
		}

		const updatedResult = await client.query(
			`SELECT
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
			 WHERE u.id = $1`,
			[user.id],
		);

		return res.json({ user: mapRow(updatedResult.rows[0]) });
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function deleteAdminUser(req: Request, res: Response, next: NextFunction) {
	const client = await getPool().connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const parsedParams = z.object({ id: z.string().min(1) }).safeParse(req.params);
		if (!parsedParams.success) {
			throw new AppError("Invalid user id", 400);
		}

		const parsedBody = deleteUserSchema.safeParse(req.body);
		if (!parsedBody.success) {
			throw new AppError(
				`Invalid user payload: ${parsedBody.error.issues.map((issue: any) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`,
				400,
			);
		}

		const userResult = await client.query(
			`SELECT id, email, name, role, "ministryId", "createdAt", "updatedAt" FROM "User" WHERE id = $1`,
			[parsedParams.data.id],
		);

		if (userResult.rows.length === 0) {
			throw new AppError("User not found", 404);
		}

		const userToDelete = userResult.rows[0] as {
			id: string;
			email: string;
			name: string;
			role: AdminUserRole;
			ministryId: string | null;
			createdAt: string;
			updatedAt: string;
		};

		if (userToDelete.email === req.user.email) {
			throw new AppError("You cannot delete your own account", 400);
		}

		await verifyAdminPassword(req.user.email, parsedBody.data.password);

		const usageCounts = await getDeleteUsageCounts(client, userToDelete.id);
		const totalUsage = Object.values(usageCounts).reduce((sum, count) => sum + Number(count ?? 0), 0);
		if (totalUsage > 0) {
			throw new AppError("This user has activity history and cannot be deleted yet", 409);
		}

		await client.query("BEGIN");
		try {
			await client.query(`DELETE FROM "User" WHERE id = $1`, [userToDelete.id]);
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		}

		try {
			await deleteCognitoUser(userToDelete.email);
		} catch (error) {
			await client.query(
				`INSERT INTO "User" (id, email, name, role, "ministryId", "createdAt", "updatedAt")
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					userToDelete.id,
					userToDelete.email,
					userToDelete.name,
					userToDelete.role,
					userToDelete.ministryId,
					userToDelete.createdAt,
					userToDelete.updatedAt,
				],
			);
			throw error;
		}

		return res.json({ userId: userToDelete.id });
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export default {
	listAdminUsers,
	createAdminUser,
	updateAdminUserRole,
	deleteAdminUser,
};