import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { NextFunction, Request, Response } from "express";

import config from "../config/env";

export enum Role {
	REQUESTER = "REQUESTER",
	PARISH_SECRETARY = "PARISH_SECRETARY",
	PARISH_PRIEST = "PARISH_PRIEST",
	ADMIN = "ADMIN",
}

export interface AuthUser {
	id: string;
	email: string;
	role: Role;
}

declare global {
	namespace Express {
		interface Request {
			user?: AuthUser;
		}
	}
}

const verifier = CognitoJwtVerifier.create({
	userPoolId: config.cognitoUserPoolId,
	tokenUse: "access",
	clientId: config.cognitoClientId,
});

function mapGroupToRole(group?: string): Role {
	switch (group) {
		case Role.ADMIN:
			return Role.ADMIN;
		case Role.PARISH_PRIEST:
			return Role.PARISH_PRIEST;
		case Role.PARISH_SECRETARY:
			return Role.PARISH_SECRETARY;
		case Role.REQUESTER:
		default:
			return Role.REQUESTER;
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

		const payload = await verifier.verify(token);
		const groups = payload["cognito:groups"];
		const group = Array.isArray(groups) && groups.length > 0 ? groups[0] : undefined;

		const sub = payload.sub;
		const email = typeof payload.email === "string" ? payload.email : "";

		if (!sub || !email) {
			return res.status(401).json({ message: "Invalid token" });
		}

		req.user = {
			id: sub,
			email,
			role: mapGroupToRole(group),
		};

		return next();
	} catch (_error) {
		return res.status(401).json({ message: "Invalid token" });
	}
}

export function requireRole(allowedRoles: Role[]) {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.user || !allowedRoles.includes(req.user.role)) {
			return res.status(403).json({ message: "Insufficient permissions" });
		}

		return next();
	};
}

export default {
	authenticate,
	requireRole,
	Role,
};
