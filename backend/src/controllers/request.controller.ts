import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const { z } = require("zod") as typeof import("zod");

const prisma = require("../config/database").default as typeof import("../config/database").default;
const {
	evaluateRequest: runDssEvaluation,
} = require("../dss/rulesEngine") as typeof import("../dss/rulesEngine");
const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("Missing required environment variable: DATABASE_URL");
}

const pool = new Pool({
	connectionString,
	ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : true,
});

const createRequestSchema = z.object({
	venueId: z.string().min(1),
	ministryId: z.string().min(1).optional(),
	eventName: z.string().min(1),
	purpose: z.string().min(1),
	startDateTime: z.coerce.date(),
	endDateTime: z.coerce.date(),
	attendees: z.coerce.number().int().positive(),
	specialRequirements: z.string().optional(),
});

const requestIdParamsSchema = z.object({
	id: z.string().min(1),
});

function toTimeString(date: Date): string {
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

export async function createRequest(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user?.id) {
			throw new AppError("Unauthorized", 401);
		}

		const parsed = createRequestSchema.safeParse(req.body);

		if (!parsed.success) {
			console.error("Validation errors:", parsed.error.errors);
			throw new AppError(
				`Invalid request payload: ${parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
				400,
			);
		}

		const input = parsed.data;

		if (input.endDateTime <= input.startDateTime) {
			throw new AppError("endDateTime must be later than startDateTime", 400);
		}

		let ministryId = input.ministryId;
		if (!ministryId) {
			const ministryResult = await client.query(
				`SELECT "ministryId" FROM "User" WHERE id = $1`,
				[req.user.id],
			);
			ministryId = ministryResult.rows[0]?.ministryId;
			if (!ministryId) {
				throw new AppError("User ministry not found. Please contact an administrator.", 400);
			}
		}

		const venueResult = await client.query(
			`SELECT id, capacity FROM "Venue" WHERE id = $1`,
			[input.venueId],
		);

		if (venueResult.rows.length === 0) {
			throw new AppError("Venue not found", 404);
		}

		const venue = venueResult.rows[0] as { id: string; capacity: number };

		const authorizedMinistriesResult = await client.query(
			`SELECT "ministryId" FROM "VenueMinistry" WHERE "venueId" = $1`,
			[input.venueId],
		);

		const conflictsResult = await client.query(
			`SELECT id FROM "VenueRequest"
			 WHERE "venueId" = $1
			 AND status <> 'REJECTED'
			 AND "startDateTime" < $2
			 AND "endDateTime" > $3`,
			[input.venueId, input.endDateTime, input.startDateTime],
		);

		const dssDecision = runDssEvaluation(
			{
				venueId: input.venueId,
				ministryId: ministryId,
				requestDate: input.startDateTime,
				startTime: toTimeString(input.startDateTime),
				endTime: toTimeString(input.endDateTime),
				attendees: input.attendees,
			},
			venue.capacity,
			authorizedMinistriesResult.rows.map((entry: { ministryId: string }) => entry.ministryId),
			conflictsResult.rows.length > 0,
		);

		if (!dssDecision.canProceed) {
			throw new AppError(`DSS evaluation failed: ${dssDecision.recommendation}`, 400);
		}

		const secretaryResult = await client.query(
			`SELECT id FROM "User" WHERE role = 'PARISH_SECRETARY' ORDER BY "createdAt" ASC LIMIT 1`,
		);

		if (secretaryResult.rows.length === 0) {
			throw new AppError("No PARISH_SECRETARY approver configured", 500);
		}

		const secretaryId = secretaryResult.rows[0].id as string;
		const requestId = randomUUID();

		await client.query(
			`INSERT INTO "VenueRequest" (
				id, "requesterId", "venueId", "ministryId", "eventName", purpose,
				"startDateTime", "endDateTime", attendees, "specialRequirements",
				status, "currentApproverId", "createdAt", "updatedAt"
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())`,
			[
				requestId,
				req.user.id,
				input.venueId,
				ministryId,
				input.eventName,
				input.purpose,
				input.startDateTime,
				input.endDateTime,
				input.attendees,
				input.specialRequirements ?? null,
				"PENDING",
				secretaryId,
			],
		);

		await client.query(
			`INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`,
			[
				randomUUID(),
				requestId,
				req.user.id,
				"REQUEST_CREATED",
				JSON.stringify({
					requestId,
					dssDecision,
				}),
				req.ip,
			],
		);

		return res.status(201).json({
			id: requestId,
			requesterId: req.user.id,
			venueId: input.venueId,
			ministryId,
			eventName: input.eventName,
			purpose: input.purpose,
			startDateTime: input.startDateTime,
			endDateTime: input.endDateTime,
			attendees: input.attendees,
			specialRequirements: input.specialRequirements ?? null,
			status: "PENDING",
			currentApproverId: secretaryId,
		});
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function getRequests(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const requestsResult = await client.query(
			`SELECT
				vr.id,
				vr."requesterId",
				vr."venueId",
				vr."ministryId",
				vr."eventName",
				vr.purpose,
				vr."startDateTime",
				vr."endDateTime",
				vr.attendees,
				vr."specialRequirements",
				vr.status,
				vr."currentApproverId",
				vr."createdAt",
				vr."updatedAt",
				v.name AS venue_name,
				m.name AS ministry_name
			 FROM "VenueRequest" vr
			 INNER JOIN "Venue" v ON v.id = vr."venueId"
			 INNER JOIN "Ministry" m ON m.id = vr."ministryId"
			 WHERE vr."requesterId" = $1
			 ORDER BY vr."createdAt" DESC`,
			[req.user.id],
		);

		const requests = requestsResult.rows.map((request) => ({
			...request,
			venue: {
				id: request.venueId,
				name: request.venue_name,
			},
			ministry: {
				id: request.ministryId,
				name: request.ministry_name,
			},
			approvalActions: [],
		}));

		return res.json({ requests });
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function getRequestById(req: Request, res: Response, next: NextFunction) {
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const parsedParams = requestIdParamsSchema.safeParse(req.params);

		if (!parsedParams.success) {
			throw new AppError("Invalid request id", 400);
		}

		const requestRecord = await prisma.venueRequest.findUnique({
			where: {
				id: parsedParams.data.id,
			},
			include: {
				venue: true,
				ministry: true,
				requester: true,
				currentApprover: true,
				approvalActions: {
					include: {
						approver: true,
					},
					orderBy: {
						createdAt: "asc",
					},
				},
			},
		});

		if (!requestRecord) {
			throw new AppError("Request not found", 404);
		}

		if (req.user.role === "REQUESTER" && requestRecord.requesterId !== req.user.id) {
			throw new AppError("Insufficient permissions", 403);
		}

		return res.json(requestRecord);
	} catch (error) {
		return next(error);
	}
}

export async function cancelRequest(req: Request, res: Response, next: NextFunction) {
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const parsedParams = requestIdParamsSchema.safeParse(req.params);

		if (!parsedParams.success) {
			throw new AppError("Invalid request id", 400);
		}

		const existingRequest = await prisma.venueRequest.findUnique({
			where: {
				id: parsedParams.data.id,
			},
		});

		if (!existingRequest) {
			throw new AppError("Request not found", 404);
		}

		if (existingRequest.requesterId !== req.user.id) {
			throw new AppError("Insufficient permissions", 403);
		}

		if (existingRequest.status !== "PENDING") {
			throw new AppError("Only PENDING requests can be cancelled", 400);
		}

		const updatedRequest = await prisma.venueRequest.update({
			where: {
				id: existingRequest.id,
			},
			data: {
				status: "REJECTED",
				currentApproverId: null,
			},
		});

		await prisma.auditLog.create({
			data: {
				requestId: existingRequest.id,
				performedById: req.user.id,
				action: "REQUEST_CANCELLED",
				details: {
					previousStatus: existingRequest.status,
					nextStatus: "REJECTED",
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
	createRequest,
	getRequests,
	getRequestById,
	cancelRequest,
};
