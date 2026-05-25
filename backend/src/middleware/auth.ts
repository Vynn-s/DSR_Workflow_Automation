import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { NextFunction, Request, Response } from "express";
import { pool } from "../config/database";
import { UserRole, type AuthUser } from "../types";

export const Role = UserRole;

declare global {
	namespace Express {
		interface Request {
			user?: AuthUser;
		}
	}
}

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
	if (verifier) {
		return verifier;
	}

	const userPoolId = process.env.COGNITO_USER_POOL_ID;
	const clientId = process.env.COGNITO_CLIENT_ID;

	if (!userPoolId || !clientId) {
		throw new Error("Missing COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID environment variables");
	}

	verifier = CognitoJwtVerifier.create({
		userPoolId,
		tokenUse: "id",
		clientId,
	});

	return verifier;
}

function mapGroupToRole(group?: string): UserRole {
	switch (group) {
		case UserRole.ADMIN:
			return UserRole.ADMIN;
		case UserRole.PARISH_PRIEST:
			return UserRole.PARISH_PRIEST;
		case UserRole.PARISH_SECRETARY:
			return UserRole.PARISH_SECRETARY;
		case UserRole.REQUESTER:
		default:
			return UserRole.REQUESTER;
	}
}

function getBearerToken(req: Request): string | null {
	const authorizationHeader = req.headers.authorization;

	if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
		return null;
	}

	const token = authorizationHeader.slice("Bearer ".length).trim();
	return token || null;
}

export async function authenticate(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const token = getBearerToken(req);

		if (!token) {
			return res.status(401).json({ message: "No token provided" });
		}

		const payload = await getVerifier().verify(token);
		const groups = payload["cognito:groups"];
		const group = Array.isArray(groups) && groups.length > 0 ? groups[0] : undefined;

		const sub = payload.sub;
		const email = typeof payload.email === "string" ? payload.email : "";
		const cognitoUsername = typeof payload["cognito:username"] === "string" ? payload["cognito:username"] : email;

		if (!sub || !email) {
			console.error("Token verified but missing required claims:", { sub, email, payload });
			return res.status(401).json({ message: "Invalid token" });
		}

		let role = mapGroupToRole(group);
		let userId = sub;

		try {
			const client = await pool.connect();
			try {
				const userResult = await client.query(`SELECT id, role FROM "User" WHERE email = $1`, [email]);
				if (userResult.rows.length > 0) {
					userId = userResult.rows[0].id;
					const dbRole = userResult.rows[0].role;
					role = mapGroupToRole(dbRole);
				}
			} finally {
				client.release();
			}
		} catch (dbError) {
			console.warn("Role lookup failed; continuing with Cognito role only:", dbError);
		}

		req.user = {
			id: userId,
			email,
			role,
			cognitoUsername,
		};

		return next();
	} catch (error) {
		console.error("Token verification failed:", error);
		return res.status(401).json({ message: "Invalid token" });
	}
}

export function requireRole(allowedRoles: UserRole[]) {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.user || !allowedRoles.includes(req.user.role)) {
			console.warn(`[ROLE_GUARD] User ${req.user?.email} has role ${req.user?.role}, allowed: ${allowedRoles.join(", ")}`);
			return res.status(403).json({ message: "Insufficient permissions" });
		}

		return next();
	};
}
