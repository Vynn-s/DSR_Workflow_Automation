import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { pool } from "../config/database";

const { z } = require("zod") as typeof import("zod");

const {
	evaluateRequest: runDssEvaluation,
} = require("../dss/rulesEngine") as typeof import("../dss/rulesEngine");
const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const evaluateRequestSchema = z.object({
	venueId: z.string().min(1),
	ministryId: z.string().min(1).optional(),
	requestId: z.string().min(1).optional(),
	requestDate: z.coerce.date(),
	startTime: z.string().regex(timePattern),
	endTime: z.string().regex(timePattern),
	attendees: z.coerce.number().int().positive(),
	attachmentCount: z.coerce.number().int().nonnegative().optional(),
	signatures: z.array(z.object({
		required: z.boolean().optional(),
		status: z.enum(["pending", "signed"]),
	})).optional(),
});

const conflictQuerySchema = z.object({
	venueId: z.string().min(1),
	date: z.coerce.date(),
	startTime: z.string().regex(timePattern),
	endTime: z.string().regex(timePattern),
});

function combineDateAndTime(date: Date, time: string): Date {
	const [hours, minutes] = time.split(":").map((value) => Number(value));
	const combined = new Date(date);
	combined.setHours(hours, minutes, 0, 0);
	return combined;
}

export async function evaluateRequest(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const client = await pool.connect();
	try {
		const parsed = evaluateRequestSchema.safeParse(req.body);

		if (!parsed.success) {
			throw new AppError("Invalid request payload for DSS evaluation", 400);
		}

		if (!req.user?.id) {
			throw new AppError("Unauthorized", 401);
		}

		let { venueId, ministryId, requestId, requestDate, startTime, endTime, attendees } = parsed.data;
		const attachmentCount = parsed.data.attachmentCount ?? 0;
		const signatures = parsed.data.signatures ?? [];
		const userResult = await client.query(
			`SELECT id, "ministryId" FROM "User" WHERE email = $1 LIMIT 1`,
			[req.user.email],
		);

		if (userResult.rows.length === 0) {
			throw new AppError("User not found", 404);
		}

		const actorUserId = userResult.rows[0].id as string;

		if (!ministryId) {
			ministryId = userResult.rows[0]?.ministryId;
		}

		if (!ministryId) {
			throw new AppError("User ministry not found", 400);
		}

		const requestedStartDateTime = combineDateAndTime(requestDate, startTime);
		const requestedEndDateTime = combineDateAndTime(requestDate, endTime);

		if (requestedEndDateTime <= requestedStartDateTime) {
			throw new AppError("End time must be after start time", 400);
		}

		const venueResult = await client.query(
			`SELECT id, capacity FROM "Venue" WHERE id = $1`,
			[venueId],
		);

		if (venueResult.rows.length === 0) {
			throw new AppError("Venue not found", 404);
		}

		const venue = venueResult.rows[0] as { id: string; capacity: number };

		const authorizedMinistriesResult = await client.query(
			`SELECT "ministryId" FROM "VenueMinistry" WHERE "venueId" = $1`,
			[venueId],
		);

		const conflictParams: Array<string | Date> = [venueId, requestedEndDateTime, requestedStartDateTime];
		let conflictQuery = `SELECT id FROM "VenueRequest"
			 WHERE "venueId" = $1
			 AND status <> 'REJECTED'
			 AND "startDateTime" < $2
			 AND "endDateTime" > $3`;

		if (requestId) {
			conflictQuery += ` AND id <> $4`;
			conflictParams.push(requestId);
		}

		const conflictsResult = await client.query(conflictQuery, conflictParams);

		const decision = runDssEvaluation(
			{
				venueId,
				ministryId,
				requestId,
				requestDate,
				startTime,
				endTime,
				attendees,
				signatures,
				attachmentCount,
			},
			venue.capacity,
			authorizedMinistriesResult.rows.map((entry: { ministryId: string }) => entry.ministryId),
			conflictsResult.rows.length > 0,
		);

		await client.query(
			`INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`,
			[
				randomUUID(),
				null,
				actorUserId,
				"DSS_EVALUATION",
				JSON.stringify({
					venueId,
					ministryId,
					requestId,
					hasConflict: conflictsResult.rows.length > 0,
					attachmentCount,
					signatureCount: signatures.length,
					decision,
				}),
				req.ip,
			],
		);

		return res.json(decision);
	} catch (error) {
		if (error instanceof AppError) {
			return next(error);
		}

		return next(new AppError("Failed to evaluate DSS request", 500));
	} finally {
		client.release();
	}
}

export async function checkConflicts(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const client = await getPool().connect();
	try {
		const parsed = conflictQuerySchema.safeParse(req.query);

		if (!parsed.success) {
			throw new AppError("Invalid conflict query parameters", 400);
		}

		const { venueId, date, startTime, endTime } = parsed.data;

		const requestedStartDateTime = combineDateAndTime(date, startTime);
		const requestedEndDateTime = combineDateAndTime(date, endTime);

		if (requestedEndDateTime <= requestedStartDateTime) {
			throw new AppError("End time must be after start time", 400);
		}

		const conflictsResult = await client.query(
			`SELECT id, "eventName", purpose, "startDateTime", "endDateTime", status, attendees
			 FROM "VenueRequest"
			 WHERE "venueId" = $1
			 AND status <> 'REJECTED'
			 AND "startDateTime" < $2
			 AND "endDateTime" > $3
			 ORDER BY "startDateTime" ASC`,
			[venueId, requestedEndDateTime, requestedStartDateTime],
		);

		return res.json({
			conflicts: conflictsResult.rows,
		});
	} catch (error) {
		if (error instanceof AppError) {
			return next(error);
		}

		return next(new AppError("Failed to check scheduling conflicts", 500));
	} finally {
		client.release();
	}
}

export default {
	evaluateRequest,
	checkConflicts,
};
