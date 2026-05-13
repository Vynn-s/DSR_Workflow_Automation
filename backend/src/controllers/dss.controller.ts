import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const { z } = require("zod") as typeof import("zod");

const {
	evaluateRequest: runDssEvaluation,
} = require("../dss/rulesEngine") as typeof import("../dss/rulesEngine");
const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const evaluateRequestSchema = z.object({
	venueId: z.string().min(1),
	ministryId: z.string().min(1).optional(),
	requestDate: z.coerce.date(),
	startTime: z.string().regex(timePattern),
	endTime: z.string().regex(timePattern),
	attendees: z.coerce.number().int().positive(),
});

const conflictQuerySchema = z.object({
	venueId: z.string().min(1),
	date: z.coerce.date(),
	startTime: z.string().regex(timePattern),
	endTime: z.string().regex(timePattern),
});

let pool: Pool | null = null;

function getPool(): Pool {
	if (pool) return pool;

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
	const client = await getPool().connect();
	try {
		const parsed = evaluateRequestSchema.safeParse(req.body);

		if (!parsed.success) {
			throw new AppError("Invalid request payload for DSS evaluation", 400);
		}

		if (!req.user?.id) {
			throw new AppError("Unauthorized", 401);
		}

		let { venueId, ministryId, requestDate, startTime, endTime, attendees } = parsed.data;

		if (!ministryId) {
			const ministryResult = await client.query(
				`SELECT "ministryId" FROM "User" WHERE id = $1`,
				[req.user.id],
			);
			ministryId = ministryResult.rows[0]?.ministryId;
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

		const conflictsResult = await client.query(
			`SELECT id FROM "VenueRequest"
			 WHERE "venueId" = $1
			 AND status <> 'REJECTED'
			 AND "startDateTime" < $2
			 AND "endDateTime" > $3`,
			[venueId, requestedEndDateTime, requestedStartDateTime],
		);

		const decision = runDssEvaluation(
			{
				venueId,
				ministryId,
				requestDate,
				startTime,
				endTime,
				attendees,
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
				req.user.id,
				"DSS_EVALUATION",
				JSON.stringify({
					venueId,
					ministryId,
					hasConflict: conflictsResult.rows.length > 0,
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
	const client = await pool.connect();
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
