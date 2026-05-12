import type { NextFunction, Request, Response } from "express";
import { Pool } from "pg";

const { z } = require("zod") as typeof import("zod");

const prisma = require("../config/database").default as typeof import("../config/database").default;
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

function getQueueStatusForRole(role: string): "PENDING" | "SECRETARY_REVIEW" | null {
	if (role === "PARISH_SECRETARY") {
		return "PENDING";
	}

	if (role === "PARISH_PRIEST") {
		return "SECRETARY_REVIEW";
	}

	return null;
}

async function getRequestOrThrow(requestId: string) {
	const requestRecord = await prisma.venueRequest.findUnique({
		where: { id: requestId },
		include: {
			requester: true,
			venue: true,
			ministry: true,
			approvalActions: true,
		},
	});

	if (!requestRecord) {
		throw new AppError("Request not found", 404);
	}

	return requestRecord;
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
			 WHERE aa."requestId" = ANY($1::uuid[])
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
	try {
		if (!req.user?.id) {
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

		const requestRecord = await getRequestOrThrow(parsedParams.data.requestId);

		let nextStatus: "SECRETARY_REVIEW" | "APPROVED";
		let nextApproverId: string | null = null;

		if (req.user.role === "PARISH_SECRETARY") {
			if (requestRecord.status !== "PENDING") {
				throw new AppError("Request is not in PENDING status", 400);
			}

			const priest = await prisma.user.findFirst({
				where: {
					role: "PARISH_PRIEST",
				},
				select: {
					id: true,
				},
			});

			if (!priest) {
				throw new AppError("No PARISH_PRIEST approver configured", 500);
			}

			nextStatus = "SECRETARY_REVIEW";
			nextApproverId = priest.id;
		} else if (req.user.role === "PARISH_PRIEST") {
			if (requestRecord.status !== "SECRETARY_REVIEW") {
				throw new AppError("Request is not in SECRETARY_REVIEW status", 400);
			}

			nextStatus = "APPROVED";
			nextApproverId = null;
		} else {
			throw new AppError("Insufficient permissions", 403);
		}

		const updatedRequest = await prisma.venueRequest.update({
			where: {
				id: requestRecord.id,
			},
			data: {
				status: nextStatus,
				currentApproverId: nextApproverId,
			},
			include: {
				venue: true,
				ministry: true,
				requester: true,
			},
		});

		await prisma.approvalAction.create({
			data: {
				requestId: requestRecord.id,
				approverId: req.user.id,
				action: "APPROVED",
				remarks: parsedBody.data.remarks,
			},
		});

		await prisma.auditLog.create({
			data: {
				requestId: requestRecord.id,
				performedById: req.user.id,
				action: "REQUEST_APPROVED",
				details: {
					previousStatus: requestRecord.status,
					nextStatus,
					approvedByRole: req.user.role,
					remarks: parsedBody.data.remarks,
				},
				ipAddress: req.ip,
			},
		});

		return res.json(updatedRequest);
	} catch (error) {
		return next(error);
	}
}

export async function rejectRequest(req: Request, res: Response, next: NextFunction) {
	try {
		if (!req.user?.id) {
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

		const requestRecord = await getRequestOrThrow(parsedParams.data.requestId);

		if (req.user.role === "PARISH_SECRETARY" && requestRecord.status !== "PENDING") {
			throw new AppError("Request is not in PENDING status", 400);
		}

		if (req.user.role === "PARISH_PRIEST" && requestRecord.status !== "SECRETARY_REVIEW") {
			throw new AppError("Request is not in SECRETARY_REVIEW status", 400);
		}

		if (!["PARISH_SECRETARY", "PARISH_PRIEST"].includes(req.user.role)) {
			throw new AppError("Insufficient permissions", 403);
		}

		const updatedRequest = await prisma.venueRequest.update({
			where: {
				id: requestRecord.id,
			},
			data: {
				status: "REJECTED",
				currentApproverId: null,
			},
		});

		await prisma.approvalAction.create({
			data: {
				requestId: requestRecord.id,
				approverId: req.user.id,
				action: "REJECTED",
				remarks: parsedBody.data.remarks,
			},
		});

		await prisma.auditLog.create({
			data: {
				requestId: requestRecord.id,
				performedById: req.user.id,
				action: "REQUEST_REJECTED",
				details: {
					previousStatus: requestRecord.status,
					nextStatus: "REJECTED",
					remarks: parsedBody.data.remarks,
				},
				ipAddress: req.ip,
			},
		});

		return res.json(updatedRequest);
	} catch (error) {
		return next(error);
	}
}

export async function requestRevision(req: Request, res: Response, next: NextFunction) {
	try {
		if (!req.user?.id) {
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

		const requestRecord = await getRequestOrThrow(parsedParams.data.requestId);

		if (req.user.role === "PARISH_SECRETARY" && requestRecord.status !== "PENDING") {
			throw new AppError("Request is not in PENDING status", 400);
		}

		if (req.user.role === "PARISH_PRIEST" && requestRecord.status !== "SECRETARY_REVIEW") {
			throw new AppError("Request is not in SECRETARY_REVIEW status", 400);
		}

		if (!["PARISH_SECRETARY", "PARISH_PRIEST"].includes(req.user.role)) {
			throw new AppError("Insufficient permissions", 403);
		}

		const updatedRequest = await prisma.venueRequest.update({
			where: {
				id: requestRecord.id,
			},
			data: {
				status: "REVISION_REQUESTED",
				currentApproverId: requestRecord.requesterId,
			},
		});

		await prisma.auditLog.create({
			data: {
				requestId: requestRecord.id,
				performedById: req.user.id,
				action: "REQUEST_REVISION_REQUESTED",
				details: {
					previousStatus: requestRecord.status,
					nextStatus: "REVISION_REQUESTED",
					remarks: parsedBody.data.remarks,
				},
				ipAddress: req.ip,
			},
		});

		return res.json(updatedRequest);
	} catch (error) {
		return next(error);
	}
}

export default {
	getApprovalQueue,
	approveRequest,
	rejectRequest,
	requestRevision,
};
