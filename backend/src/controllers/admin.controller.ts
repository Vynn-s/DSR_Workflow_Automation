import type { NextFunction, Request, Response } from "express";
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import {
	AdminAddUserToGroupCommand,
	AdminCreateUserCommand,
	AdminInitiateAuthCommand,
	AdminDeleteUserCommand,
	AdminListGroupsForUserCommand,
	ListUsersCommand,
	AdminRemoveUserFromGroupCommand,
	InitiateAuthCommand,
	CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

import config from "../config/env";
import { pool } from "../config/database";
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

type CognitoUserRecord = {
	email: string;
	name: string;
	role: AdminUserRole;
};

type CognitoGroupRole = Exclude<AdminUserRole, "ADMIN">;

let cognitoClient: CognitoIdentityProviderClient | null = null;

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
	password: z.string().trim().max(256).optional(),
});

const cognitoGroupRoles: CognitoGroupRole[] = ["REQUESTER", "PARISH_SECRETARY", "PARISH_PRIEST"];

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

function getUserAttributeValue(attributes: Array<{ Name?: string; Value?: string }> | undefined, attributeName: string): string | null {
	return attributes?.find((attribute) => attribute.Name === attributeName)?.Value ?? null;
}

function mapCognitoGroupToRole(groupName?: string): AdminUserRole {
	switch (groupName) {
		case "PARISH_PRIEST":
			return groupName;
		case "PARISH_SECRETARY":
		case "REQUESTER":
			return groupName;
		default:
			return "REQUESTER";
	}
}

function mapRoleToCognitoGroup(role: AdminUserRole): CognitoGroupRole {
	switch (role) {
		case "ADMIN":
			return "PARISH_PRIEST";
		case "PARISH_PRIEST":
			return "PARISH_PRIEST";
		case "PARISH_SECRETARY":
			return "PARISH_SECRETARY";
		case "REQUESTER":
		default:
			return "REQUESTER";
	}
}

function mapCognitoCreateUserError(error: any): InstanceType<typeof AppError> | null {
	if (error?.name === "UsernameExistsException") {
		return new AppError("A user with that email already exists in Cognito", 409);
	}

	if (error?.name === "InvalidPasswordException" || error?.name === "InvalidParameterException") {
		return new AppError("Temporary password does not meet Cognito password requirements", 400);
	}

	if (error?.name === "ResourceNotFoundException") {
		return new AppError("Cognito user pool configuration is incomplete", 500);
	}

	return null;
}

async function listAllCognitoUsers(): Promise<CognitoUserRecord[]> {
	if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
		return [];
	}

	const client = getCognitoClient();
	const users: CognitoUserRecord[] = [];
	let paginationToken: string | undefined;

	do {
		const response = await client.send(
			new ListUsersCommand({
				UserPoolId: config.cognitoUserPoolId,
				PaginationToken: paginationToken,
				Limit: 60,
			}),
		);

		for (const user of (response as { Users?: Array<{ Username?: string; Attributes?: Array<{ Name?: string; Value?: string }> }> }).Users ?? []) {
			const email = getUserAttributeValue(user.Attributes, "email") ?? user.Username ?? "";
			if (!email) {
				continue;
			}

			const name = getUserAttributeValue(user.Attributes, "name") ?? email.split("@")[0] ?? email;
			let role = "REQUESTER" as AdminUserRole;

			try {
				const groupsResult = await client.send(
					new AdminListGroupsForUserCommand({
						UserPoolId: config.cognitoUserPoolId,
						Username: email,
					}),
				);

				const groupName = groupsResult.Groups?.find((group) => group.GroupName && cognitoGroupRoles.includes(group.GroupName as CognitoGroupRole))?.GroupName;
				role = mapCognitoGroupToRole(groupName);
			} catch (groupError) {
				console.warn(`Unable to read Cognito group for ${email}:`, groupError);
			}

			users.push({ email, name, role });
		}

		paginationToken = (response as { PaginationToken?: string }).PaginationToken;
	} while (paginationToken);

	return users;
}

async function upsertUserFromCognito(client: import("pg").PoolClient, user: CognitoUserRecord) {
	await client.query(
		`INSERT INTO "User" (id, email, name, role, "ministryId", "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, NULL, NOW(), NOW())
		 ON CONFLICT (email) DO UPDATE SET
		 	name = EXCLUDED.name,
		 	role = EXCLUDED.role,
		 	"updatedAt" = NOW()`,
		[randomUUID(), user.email, user.name, user.role],
	);
}

async function syncCognitoRole(email: string, nextRole: AdminUserRole) {
	const client = getCognitoClient();

	let groupsResult;
	try {
		groupsResult = await client.send(
			new AdminListGroupsForUserCommand({
				UserPoolId: config.cognitoUserPoolId,
				Username: email,
			}),
		);
	} catch (error: any) {
		if (error?.name === "ResourceNotFoundException" || error?.name === "UserNotFoundException") {
			console.warn(`Skipping Cognito role sync for ${email}: user or group is missing.`);
			return;
		}

		throw error;
	}

	for (const group of groupsResult.Groups ?? []) {
		if (group.GroupName && cognitoGroupRoles.includes(group.GroupName as CognitoGroupRole) && group.GroupName !== mapRoleToCognitoGroup(nextRole)) {
			try {
				await client.send(
					new AdminRemoveUserFromGroupCommand({
						UserPoolId: config.cognitoUserPoolId,
						Username: email,
						GroupName: group.GroupName,
					}),
				);
			} catch (error: any) {
				if (error?.name !== "ResourceNotFoundException") {
					throw error;
				}
			}
		}
	}

	try {
		await client.send(
			new AdminAddUserToGroupCommand({
				UserPoolId: config.cognitoUserPoolId,
				Username: email,
				GroupName: mapRoleToCognitoGroup(nextRole),
			}),
		);
	} catch (error: any) {
		if (error?.name !== "ResourceNotFoundException" && error?.name !== "UserNotFoundException") {
			throw error;
		}

		console.warn(`Skipping Cognito add-to-group for ${email}: user or group is missing.`);
	}
}

async function deleteCognitoUser(email: string) {
	if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
		throw new AppError(
			"AWS credentials are not configured on the server, so Cognito users cannot be deleted yet.",
			500,
		);
	}

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

		if (error?.name === "InvalidParameterException") {
			try {
				await getCognitoClient().send(
					new InitiateAuthCommand({
						ClientId: config.cognitoClientId,
						AuthFlow: "USER_PASSWORD_AUTH",
						AuthParameters: {
							USERNAME: email,
							PASSWORD: password,
						},
					}),
				);
				return;
			} catch (fallbackError: any) {
				if (fallbackError?.name === "NotAuthorizedException" || fallbackError?.name === "UserNotFoundException" || fallbackError?.name === "InvalidParameterException") {
					throw new AppError("Invalid password", 401);
				}

				throw fallbackError;
			}
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
	const client = await pool.connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		let usersResult = await client.query(
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

		try {
			const cognitoUsers = await listAllCognitoUsers();

			for (const cognitoUser of cognitoUsers) {
				await upsertUserFromCognito(client, cognitoUser);
			}

			usersResult = await client.query(
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
		} catch (syncError) {
			console.error("Failed to sync admin users from Cognito:", syncError);
		}

		return res.json({ users: usersResult.rows.map(mapRow) });
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function createAdminUser(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
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
			console.warn(`Unable to sync Cognito groups for ${email}:`, error);
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
		const mappedError = mapCognitoCreateUserError(error);
		if (mappedError) {
			if (req.body?.email && cognitoUserCreated) {
				await deleteCognitoUser(req.body.email);
			}
			return next(mappedError);
		}

		if (req.body?.email && cognitoUserCreated) {
			await deleteCognitoUser(req.body.email);
		}
		return next(error);
	} finally {
		client.release();
	}
}

export async function updateAdminUserRole(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
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

		try {
			await client.query(
				`UPDATE "User"
				 SET role = $1, "updatedAt" = NOW()
				 WHERE id = $2`,
				[nextRole, user.id],
			);
		} catch (error) {
			throw error;
		}

		if (user.role !== nextRole) {
			try {
				await syncCognitoRole(user.email, nextRole);
			} catch (error) {
				console.warn(`Unable to sync Cognito role for ${user.email}; database role was updated successfully.`, error);
			}
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
	const client = await pool.connect();
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
			if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23503") {
				throw new AppError("This user is still referenced by related records and cannot be deleted yet", 409);
			}
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