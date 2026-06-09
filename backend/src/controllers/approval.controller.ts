import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

const { z } = require("zod") as typeof import("zod");
import { pool } from "../config/database";
const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

const requestIdParamsSchema = z.object({
	requestId: z.string().min(1),
});

const remarksSchema = z.object({
	remarks: z.string().trim().min(1),
});

const optionalRemarksSchema = z.object({
	remarks: z.string().trim().optional(),
});

const listQuerySchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

function getQueueStatusForRole(role: string): "PENDING" | null {
	if (role === "PARISH_SECRETARY" || role === "PARISH_PRIEST" || role === "ADMIN") {
		return "PENDING";
	}

	return null;
}

function parseListPagination(query: Request["query"]) {
	const parsed = listQuerySchema.safeParse(query);
	if (!parsed.success) {
		throw new AppError("Invalid pagination parameters", 400);
	}

	return {
		page: parsed.data.page ?? 1,
		limit: parsed.data.limit ?? 100,
	};
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

async function createNotification(
  client: import("pg").PoolClient,
  input: {
    userId: string;
    requestId?: string | null;
    type: string;
    title: string;
    message: string;
    details?: string | null;
  },
) {
  await client.query(
    `INSERT INTO "Notification" (id, "userId", "requestId", type, title, message, details, "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [randomUUID(), input.userId, input.requestId ?? null, input.type, input.title, input.message, input.details ?? null],
  );
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

		const { page, limit } = parseListPagination(req.query);
		const offset = (page - 1) * limit;

		const totalResult = await client.query(
			`SELECT COUNT(*)::int AS total FROM "VenueRequest" WHERE status = $1`,
			[queueStatus],
		);

		const queueResult = await client.query(
			`SELECT
				vr.id,
				vr."venueId",
				vr."ministryId",
				vr.attendees,
				vr."eventName",
				vr.purpose,
				vr."startDateTime",
				vr."endDateTime",
				vr.attachments,
				vr.signatures,
				vr.status,
				vr."createdAt",
				vr."updatedAt",
				er.id AS report_id,
				er.report AS report_text,
				er."submittedAt" AS report_submitted_at,
				r.name AS requester_name,
				r.email AS requester_email,
				v.name AS venue_name,
				m.name AS ministry_name
			 FROM "VenueRequest" vr
			 INNER JOIN "User" r ON r.id = vr."requesterId"
			 INNER JOIN "Venue" v ON v.id = vr."venueId"
			 INNER JOIN "Ministry" m ON m.id = vr."ministryId"
			 LEFT JOIN "EventReport" er ON er."requestId" = vr.id
			 WHERE vr.status = $1
			 ORDER BY vr."createdAt" ASC
			 LIMIT $2 OFFSET $3`,
			[queueStatus, limit, offset],
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
			venueId: request.venueId,
			ministryId: request.ministryId,
			attendees: request.attendees,
			eventName: request.eventName,
			purpose: request.purpose,
			startDateTime: request.startDateTime,
			endDateTime: request.endDateTime,
				attachments: request.attachments ?? [],
				signatures: request.signatures ?? [],
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
			eventReport: request.report_id ? {
				id: request.report_id,
				requestId: request.id,
				report: request.report_text,
				submittedAt: request.report_submitted_at,
			} : null,
		}));

		return res.json({
			queue,
			page,
			limit,
			total: totalResult.rows[0]?.total ?? 0,
			totalPages: Math.max(1, Math.ceil((totalResult.rows[0]?.total ?? 0) / limit)),
		});
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

		// Block requesters from approving their own submissions even if they somehow reach this endpoint.
		if (requestRecord.requesterId === actorUserId) {
			throw new AppError("Requesters cannot approve their own requests", 403);
		}

		let nextStatus: "APPROVED";
		let nextApproverId: string | null = null;

		if (requestRecord.status !== "PENDING") {
			throw new AppError("Request is not in PENDING status", 400);
		}

		if (!["PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"].includes(req.user.role)) {
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
					ministryId: requestRecord.ministryId ?? null,
					ministryName: null,
				}),
				req.ip,
			],
		);

		// Attempt to include ministry name if available (non-blocking)
		if (requestRecord.ministryId) {
			try {
				const mres = await client.query(`SELECT name FROM "Ministry" WHERE id = $1`, [requestRecord.ministryId]);
				const ministryName = mres.rows[0]?.name ?? null;
				await client.query(
					`UPDATE "AuditLog" SET details = details || $1::jsonb WHERE "requestId" = $2 AND action = 'REQUEST_APPROVED'`,
					[JSON.stringify({ ministryName }), requestRecord.id],
				);
			} catch (e) {
				// Don't fail the request if ministry name lookup fails
				console.warn("Failed to attach ministry name to audit log", e);
			}
		}

		await createNotification(client, {
			userId: requestRecord.requesterId,
			requestId: requestRecord.id,
			type: "approved",
			title: "DSR request approved",
			message: "Your DSR request has been approved.",
			details: parsedBody.data.remarks ? `Approver remarks: ${parsedBody.data.remarks}` : "Your venue reservation is now confirmed.",
		});

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

		// Block requesters from rejecting their own submissions even if they somehow reach this endpoint.
		if (requestRecord.requesterId === actorUserId) {
			throw new AppError("Requesters cannot reject their own requests", 403);
		}

		if (requestRecord.status !== "PENDING") {
			throw new AppError("Request is not in PENDING status", 400);
		}

		if (!["PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"].includes(req.user.role)) {
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
					ministryId: requestRecord.ministryId ?? null,
					ministryName: null,
				}),
				req.ip,
			],
		);

		if (requestRecord.ministryId) {
			try {
				const mres = await client.query(`SELECT name FROM "Ministry" WHERE id = $1`, [requestRecord.ministryId]);
				const ministryName = mres.rows[0]?.name ?? null;
				await client.query(
					`UPDATE "AuditLog" SET details = details || $1::jsonb WHERE "requestId" = $2 AND action = 'REQUEST_REJECTED'`,
					[JSON.stringify({ ministryName }), requestRecord.id],
				);
			} catch (e) {
				console.warn("Failed to attach ministry name to audit log", e);
			}
		}

		await createNotification(client, {
			userId: requestRecord.requesterId,
			requestId: requestRecord.id,
			type: "rejected",
			title: "DSR request rejected",
			message: "Your DSR request has been rejected.",
			details: `Reason: ${parsedBody.data.remarks}`,
		});

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

		// Block requesters from sending revision requests to themselves.
		if (requestRecord.requesterId === actorUserId) {
			throw new AppError("Requesters cannot request revisions on their own requests", 403);
		}

		if (requestRecord.status !== "PENDING") {
			throw new AppError("Request is not in PENDING status", 400);
		}

		if (!["PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"].includes(req.user.role)) {
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

		await createNotification(client, {
			userId: requestRecord.requesterId,
			requestId: requestRecord.id,
			type: "revision",
			title: "DSR revision requested",
			message: "An approver requested changes to your DSR request.",
			details: parsedBody.data.remarks,
		});

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

		if (!["PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"].includes(req.user.role)) {
			throw new AppError("Insufficient permissions", 403);
		}

		const { page, limit } = parseListPagination(req.query);
		const offset = (page - 1) * limit;

		const totalResult = await client.query(
			`SELECT COUNT(*)::int AS total FROM "VenueRequest" WHERE status IN ('APPROVED', 'REJECTED', 'REVISION_REQUESTED')`,
		);

		const archiveResult = await client.query(
			`SELECT
				vr.id,
				vr."eventName",
				vr.purpose,
				vr."startDateTime",
				vr."endDateTime",
				vr.attachments,
				vr.signatures,
				vr.status,
				vr."createdAt",
				vr."updatedAt",
				er.id AS report_id,
				er.report AS report_text,
				er."submittedAt" AS report_submitted_at,
				r.name AS requester_name,
				r.email AS requester_email,
				v.name AS venue_name,
				m.name AS ministry_name
			 FROM "VenueRequest" vr
			 INNER JOIN "User" r ON r.id = vr."requesterId"
			 INNER JOIN "Venue" v ON v.id = vr."venueId"
			 INNER JOIN "Ministry" m ON m.id = vr."ministryId"
			 LEFT JOIN "EventReport" er ON er."requestId" = vr.id
			 WHERE vr.status IN ('APPROVED', 'REJECTED', 'REVISION_REQUESTED')
			 ORDER BY vr."updatedAt" DESC
			 LIMIT $1 OFFSET $2`,
			[limit, offset],
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
				attachments: request.attachments ?? [],
				signatures: request.signatures ?? [],
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
			eventReport: request.report_id ? {
				id: request.report_id,
				requestId: request.id,
				report: request.report_text,
				submittedAt: request.report_submitted_at,
			} : null,
		}));

		return res.json({
			archive,
			page,
			limit,
			total: totalResult.rows[0]?.total ?? 0,
			totalPages: Math.max(1, Math.ceil((totalResult.rows[0]?.total ?? 0) / limit)),
		});
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
