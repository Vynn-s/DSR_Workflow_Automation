import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const { z } = require("zod") as typeof import("zod");
const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("Missing required environment variable: DATABASE_URL");
}

const pool = new Pool({
	connectionString,
	ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : true,
});

const requestIdParamsSchema = z.object({
	requestId: z.string().min(1),
});

const remarksSchema = z.object({
	remarks: z.string().min(1),
});

const optionalRemarksSchema = z.object({
	remarks: z.string().optional(),
});

function getQueueStatusForRole(role: string): "PENDING" | null {
	if (role === "PARISH_SECRETARY" || role === "PARISH_PRIEST") {
		return "PENDING";
	}

	return null;
}

async function getRequestOrThrow(client: import("pg").PoolClient, requestId: string) {
	const requestResult = await client.query(
		`SELECT id, status, "requesterId", "venueId", "ministryId", "currentApproverId", "createdAt", "updatedAt"
		 FROM "VenueRequest"
		 WHERE id = $1`,
		[requestId],
	);

	if (requestResult.rows.length === 0) {
		throw new AppError("Request not found", 404);
	}

	return requestResult.rows[0] as {
		id: string;
		status: string;
		requesterId: string;
		venueId: string;
		ministryId: string;
		currentApproverId: string | null;
		createdAt: string;
		updatedAt: string;
	};
}

async function getUserIdForEmail(client: import("pg").PoolClient, email: string, role: string) {
	const userResult = await client.query(
		`SELECT id FROM "User" WHERE email = $1 LIMIT 1`,
		[email],
	);

	if (userResult.rows.length === 0) {
		console.warn(`Creating fallback user for authenticated email: ${email} with role: ${role}`);
		const fallbackUserId = randomUUID();
		await client.query(
			`INSERT INTO "User" (id, email, name, role, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, NOW(), NOW())
			 ON CONFLICT (email) DO UPDATE SET "updatedAt" = NOW()
			 RETURNING id`,
			[fallbackUserId, email, email.split("@")[0], role]
		);
		const createdResult = await client.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
		return createdResult.rows[0].id as string;
	}

	return userResult.rows[0].id as string;
}

export async function getApprovalQueue(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const queueStatus = getQueueStatusForRole(req.user.role);

		if (!queueStatus) {
			throw new AppError("Insufficient permissions", 403);
		}

		const queueResult = await client.query(
			`SELECT
				vr.id,
				vr."eventName",
				vr.purpose,
				vr."startDateTime",
				vr."endDateTime",
				vr.status,
				vr."createdAt",
				vr."updatedAt",
				r.name AS requester_name,
				r.email AS requester_email,
				v.name AS venue_name,
				m.name AS ministry_name
			 FROM "VenueRequest" vr
			 INNER JOIN "User" r ON r.id = vr."requesterId"
			 INNER JOIN "Venue" v ON v.id = vr."venueId"
			 INNER JOIN "Ministry" m ON m.id = vr."ministryId"
			 WHERE vr.status = $1
			 ORDER BY vr."createdAt" ASC`,
			[queueStatus],
		);

		const approvalActionsResult = await client.query(
			`SELECT
				aa."requestId",
				aa."approverId",
				aa.action,
				aa.remarks,
				aa."createdAt",
				u.name AS approver_name,
				u.email AS approver_email
			 FROM "ApprovalAction" aa
			 INNER JOIN "User" u ON u.id = aa."approverId"
			 WHERE aa."requestId" = ANY($1::text[])
			 ORDER BY aa."createdAt" ASC`,
			[queueResult.rows.map((row) => row.id)],
		);

		const approvalActionsByRequestId = new Map<string, Array<Record<string, unknown>>>();
		for (const action of approvalActionsResult.rows) {
			const requestActions = approvalActionsByRequestId.get(action.requestId) ?? [];
			requestActions.push({
				remarks: action.remarks,
				createdAt: action.createdAt,
				approver: {
					id: action.approverId,
					name: action.approver_name,
					email: action.approver_email,
				},
				action: action.action,
			});
			approvalActionsByRequestId.set(action.requestId, requestActions);
		}

		const queue = queueResult.rows.map((request) => ({
			id: request.id,
			eventName: request.eventName,
			purpose: request.purpose,
			startDateTime: request.startDateTime,
			endDateTime: request.endDateTime,
			status: request.status,
			createdAt: request.createdAt,
			updatedAt: request.updatedAt,
			requester: {
				name: request.requester_name,
				email: request.requester_email,
			},
			venue: {
				name: request.venue_name,
			},
			ministry: {
				name: request.ministry_name,
			},
			approvalActions: approvalActionsByRequestId.get(request.id) ?? [],
		}));

		return res.json({ queue });
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function approveRequest(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user?.email) {
			throw new AppError("Unauthorized", 401);
		}

		const parsedParams = requestIdParamsSchema.safeParse(req.params);
		if (!parsedParams.success) {
			throw new AppError("Invalid request id", 400);
		}

		const parsedBody = optionalRemarksSchema.safeParse(req.body ?? {});
		if (!parsedBody.success) {
			throw new AppError("Invalid approval payload", 400);
		}

		const requestRecord = await getRequestOrThrow(client, parsedParams.data.requestId);
		const actorUserId = await getUserIdForEmail(client, req.user.email, req.user.role);

		let nextStatus: "APPROVED";
		let nextApproverId: string | null = null;

		if (requestRecord.status !== "PENDING") {
			throw new AppError("Request is not in PENDING status", 400);
		}

		if (!["PARISH_SECRETARY", "PARISH_PRIEST"].includes(req.user.role)) {
			throw new AppError("Insufficient permissions", 403);
		}

		nextStatus = "APPROVED";
		nextApproverId = null;

		await client.query(
			`UPDATE "VenueRequest"
			 SET status = $1, "currentApproverId" = $2, "updatedAt" = NOW()
			 WHERE id = $3`,
			[nextStatus, nextApproverId, requestRecord.id],
		);

		await client.query(
			`INSERT INTO "ApprovalAction" (id, "requestId", "approverId", action, remarks, "createdAt")
			 VALUES ($1, $2, $3, $4, $5, NOW())`,
			[
				randomUUID(),
				requestRecord.id,
				actorUserId,
				"APPROVED",
				parsedBody.data.remarks ?? null,
			],
		);

		await client.query(
			`INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`,
			[
				randomUUID(),
				requestRecord.id,
				actorUserId,
				"REQUEST_APPROVED",
				JSON.stringify({
					previousStatus: requestRecord.status,
					nextStatus,
					approvedByRole: req.user.role,
					remarks: parsedBody.data.remarks ?? null,
				}),
				req.ip,
			],
		);

		return res.json({
			id: requestRecord.id,
			status: nextStatus,
			currentApproverId: nextApproverId,
		});
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function rejectRequest(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user?.email) {
			throw new AppError("Unauthorized", 401);
		}

		const parsedParams = requestIdParamsSchema.safeParse(req.params);
		if (!parsedParams.success) {
			throw new AppError("Invalid request id", 400);
		}

		const parsedBody = remarksSchema.safeParse(req.body ?? {});
		if (!parsedBody.success) {
			throw new AppError("Remarks are required", 400);
		}

		const requestRecord = await getRequestOrThrow(client, parsedParams.data.requestId);
		const actorUserId = await getUserIdForEmail(client, req.user.email, req.user.role);

		if (requestRecord.status !== "PENDING") {
			throw new AppError("Request is not in PENDING status", 400);
		}

		if (!["PARISH_SECRETARY", "PARISH_PRIEST"].includes(req.user.role)) {
			throw new AppError("Insufficient permissions", 403);
		}

		await client.query(
			`UPDATE "VenueRequest"
			 SET status = 'REJECTED', "currentApproverId" = NULL, "updatedAt" = NOW()
			 WHERE id = $1`,
			[requestRecord.id],
		);

		await client.query(
			`INSERT INTO "ApprovalAction" (id, "requestId", "approverId", action, remarks, "createdAt")
			 VALUES ($1, $2, $3, $4, $5, NOW())`,
			[
				randomUUID(),
				requestRecord.id,
				actorUserId,
				"REJECTED",
				parsedBody.data.remarks,
			],
		);

		await client.query(
			`INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`,
			[
				randomUUID(),
				requestRecord.id,
				actorUserId,
				"REQUEST_REJECTED",
				JSON.stringify({
					previousStatus: requestRecord.status,
					nextStatus: "REJECTED",
					remarks: parsedBody.data.remarks,
				}),
				req.ip,
			],
		);

		return res.json({
			id: requestRecord.id,
			status: "REJECTED",
			currentApproverId: null,
		});
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function requestRevision(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user?.email) {
			throw new AppError("Unauthorized", 401);
		}

		const parsedParams = requestIdParamsSchema.safeParse(req.params);
		if (!parsedParams.success) {
			throw new AppError("Invalid request id", 400);
		}

		const parsedBody = remarksSchema.safeParse(req.body ?? {});
		if (!parsedBody.success) {
			throw new AppError("Remarks are required", 400);
		}

		const requestRecord = await getRequestOrThrow(client, parsedParams.data.requestId);
		const actorUserId = await getUserIdForEmail(client, req.user.email, req.user.role);

		if (requestRecord.status !== "PENDING") {
			throw new AppError("Request is not in PENDING status", 400);
		}

		if (!["PARISH_SECRETARY", "PARISH_PRIEST"].includes(req.user.role)) {
			throw new AppError("Insufficient permissions", 403);
		}

		await client.query(
			`UPDATE "VenueRequest"
			 SET status = 'REVISION_REQUESTED', "currentApproverId" = $1, "updatedAt" = NOW()
			 WHERE id = $2`,
			[requestRecord.requesterId, requestRecord.id],
		);

		await client.query(
			`INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`,
			[
				randomUUID(),
				requestRecord.id,
				actorUserId,
				"REQUEST_REVISION_REQUESTED",
				JSON.stringify({
					previousStatus: requestRecord.status,
					nextStatus: "REVISION_REQUESTED",
					remarks: parsedBody.data.remarks,
				}),
				req.ip,
			],
		);

		return res.json({
			id: requestRecord.id,
			status: "REVISION_REQUESTED",
			currentApproverId: requestRecord.requesterId,
		});
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function getArchive(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		if (!["PARISH_SECRETARY", "PARISH_PRIEST"].includes(req.user.role)) {
			throw new AppError("Insufficient permissions", 403);
		}

		const archiveResult = await client.query(
			`SELECT
				vr.id,
				vr."eventName",
				vr.purpose,
				vr."startDateTime",
				vr."endDateTime",
				vr.status,
				vr."createdAt",
				vr."updatedAt",
				r.name AS requester_name,
				r.email AS requester_email,
				v.name AS venue_name,
				m.name AS ministry_name
			 FROM "VenueRequest" vr
			 INNER JOIN "User" r ON r.id = vr."requesterId"
			 INNER JOIN "Venue" v ON v.id = vr."venueId"
			 INNER JOIN "Ministry" m ON m.id = vr."ministryId"
			 WHERE vr.status IN ('APPROVED', 'REJECTED', 'REVISION_REQUESTED')
			 ORDER BY vr."updatedAt" DESC`,
		);

		const approvalActionsResult = await client.query(
			`SELECT
				aa."requestId",
				aa."approverId",
				aa.action,
				aa.remarks,
				aa."createdAt",
				u.name AS approver_name,
				u.email AS approver_email
			 FROM "ApprovalAction" aa
			 INNER JOIN "User" u ON u.id = aa."approverId"
			 WHERE aa."requestId" = ANY($1::text[])
			 ORDER BY aa."createdAt" ASC`,
			[archiveResult.rows.map((row) => row.id)],
		);

		const approvalActionsByRequestId = new Map<string, Array<Record<string, unknown>>>();
		for (const action of approvalActionsResult.rows) {
			const requestActions = approvalActionsByRequestId.get(action.requestId) ?? [];
			requestActions.push({
				remarks: action.remarks,
				createdAt: action.createdAt,
				approver: {
					id: action.approverId,
					name: action.approver_name,
					email: action.approver_email,
				},
				action: action.action,
			});
			approvalActionsByRequestId.set(action.requestId, requestActions);
		}

		const archive = archiveResult.rows.map((request) => ({
			id: request.id,
			eventName: request.eventName,
			purpose: request.purpose,
			startDateTime: request.startDateTime,
			endDateTime: request.endDateTime,
			status: request.status,
			createdAt: request.createdAt,
			updatedAt: request.updatedAt,
			requester: {
				name: request.requester_name,
				email: request.requester_email,
			},
			venue: {
				name: request.venue_name,
			},
			ministry: {
				name: request.ministry_name,
			},
			approvalActions: approvalActionsByRequestId.get(request.id) ?? [],
		}));

		return res.json({ archive });
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export default {
	getApprovalQueue,
	approveRequest,
	rejectRequest,
	requestRevision,
	getArchive,
};
