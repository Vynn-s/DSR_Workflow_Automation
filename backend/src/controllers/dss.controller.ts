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

const recommendationQuerySchema = z.object({
	date: z.coerce.date(),
	venueId: z.string().min(1).optional(),
	ministryId: z.string().min(1).optional(),
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

function getMonthWindow(date: Date) {
	const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
	const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
	return { start, end };
}

function formatCountList(entries: Array<{ name: string; total: number }>) {
	return entries.map((entry) => `${entry.name} (${entry.total})`);
}

function formatTimeForResponse(value: Date): string {
	return value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateForResponse(value: Date): string {
	return value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildNextAvailableSlot(
	requestedStartDateTime: Date,
	requestedEndDateTime: Date,
	conflicts: Array<{ endDateTime: Date }>,
) {
	if (conflicts.length === 0) {
		return null;
	}

	const durationMs = requestedEndDateTime.getTime() - requestedStartDateTime.getTime();
	const latestConflictEnd = conflicts.reduce((latest, conflict) => {
		return conflict.endDateTime > latest ? conflict.endDateTime : latest;
	}, conflicts[0].endDateTime);
	const nextStart = new Date(latestConflictEnd);
	const nextEnd = new Date(nextStart.getTime() + durationMs);
	const closingTime = new Date(requestedStartDateTime);
	closingTime.setHours(22, 0, 0, 0);

	if (nextEnd > closingTime) {
		return null;
	}

	return {
		date: nextStart.toISOString(),
		dateLabel: formatDateForResponse(nextStart),
		startTime: `${String(nextStart.getHours()).padStart(2, "0")}:${String(nextStart.getMinutes()).padStart(2, "0")}`,
		endTime: `${String(nextEnd.getHours()).padStart(2, "0")}:${String(nextEnd.getMinutes()).padStart(2, "0")}`,
		startTimeLabel: formatTimeForResponse(nextStart),
		endTimeLabel: formatTimeForResponse(nextEnd),
	};
}

function getSeasonalContext(monthName: string): string[] {
	const seasonalNotes: Record<string, string[]> = {
		January: [
			"Feast of the Santo Nino",
			"Jesus Nazareno",
			"Lector Recruitment",
			"Bible Month",
			"Bible Symposiums",
		],
		February: [],
		March: ["Lent Preparations", "Meetings", "Practices"],
		April: ["Holy Week", "Meetings", "Practices", "Gatherings", "Recollections", "Lectures", "Confessions"],
		May: ["Month of Ministry Recruitment", "Heavy Meetings and Practices"],
		June: ["Cathedral Fiesta Celebrations", "Meetings", "Practices"],
		July: ["Regular Schedules of Ministry Meetings"],
		August: ["Regular Schedules of Ministry Meetings"],
		September: ["Vocation Month"],
		October: ["Month of the Holy Rosary"],
		November: ["Advent Preparations"],
		December: ["Advent Recollections", "Confessions", "Christmas Celebrations", "Utilization of Facilities for Holding Areas", "Preparation rooms", "Meetings", "Practices"],
	};

	return seasonalNotes[monthName] ?? [];
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
		let conflictQuery = `SELECT vr.id, vr."eventName", vr.purpose, vr."startDateTime", vr."endDateTime", vr.status, vr.attendees,
				COALESCE(u.name, u.email, 'Requester') AS "requesterName",
				v.name AS "venueName"
			 FROM "VenueRequest" vr
			 LEFT JOIN "User" u ON u.id = vr."requesterId"
			 LEFT JOIN "Venue" v ON v.id = vr."venueId"
			 WHERE vr."venueId" = $1
			 AND vr.status <> 'REJECTED'
			 AND vr."startDateTime" < $2
			 AND vr."endDateTime" > $3`;

		if (requestId) {
			conflictQuery += ` AND id <> $4`;
			conflictParams.push(requestId);
		}

		conflictQuery += ` ORDER BY vr."startDateTime" ASC`;

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
		const conflictDetails = conflictsResult.rows.map((row: {
			id: string;
			eventName?: string | null;
			purpose?: string | null;
			startDateTime: Date;
			endDateTime: Date;
			status: string;
			attendees?: number | null;
			requesterName?: string | null;
			venueName?: string | null;
		}) => ({
			id: row.id,
			eventName: row.eventName ?? row.purpose ?? "Existing booking",
			purpose: row.purpose ?? row.eventName ?? "Existing booking",
			requesterName: row.requesterName ?? "Requester",
			venueName: row.venueName ?? "Selected venue",
			status: row.status,
			attendees: row.attendees ?? null,
			startDateTime: row.startDateTime,
			endDateTime: row.endDateTime,
			startTimeLabel: formatTimeForResponse(row.startDateTime),
			endTimeLabel: formatTimeForResponse(row.endDateTime),
			dateLabel: formatDateForResponse(row.startDateTime),
		}));
		const nextAvailableSlot = buildNextAvailableSlot(requestedStartDateTime, requestedEndDateTime, conflictsResult.rows);
		const enrichedDecision = {
			...decision,
			conflicts: conflictDetails,
			nextAvailableSlot,
		};

		let ministryName: string | null = null;
		if (ministryId) {
			const mres = await client.query(`SELECT name FROM "Ministry" WHERE id = $1`, [ministryId]);
			ministryName = mres.rows[0]?.name ?? null;
		}

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
					ministryName,
					requestId,
					hasConflict: conflictsResult.rows.length > 0,
					attachmentCount,
					signatureCount: signatures.length,
					decision: enrichedDecision,
				}),
				req.ip,
			],
		);

		return res.json(enrichedDecision);
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

export async function getBookingRecommendations(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const client = await pool.connect();
	try {
		const parsed = recommendationQuerySchema.safeParse(req.query);

		if (!parsed.success) {
			throw new AppError("Invalid recommendation query parameters", 400);
		}

		const { date, venueId, ministryId } = parsed.data;
		const { start, end } = getMonthWindow(date);
		const monthLabel = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
		const monthName = date.toLocaleDateString("en-US", { month: "long" });
		const seasonalContext = getSeasonalContext(monthName);

		const [venuesResult, ministriesResult, purposesResult, selectedVenueResult, selectedMinistryResult] = await Promise.all([
			client.query(
				`SELECT v.name, COUNT(*)::int AS total
				 FROM "VenueRequest" vr
				 INNER JOIN "Venue" v ON v.id = vr."venueId"
				 WHERE vr."startDateTime" >= $1
				   AND vr."startDateTime" < $2
				   AND vr.status <> 'REJECTED'
				 GROUP BY v.name
				 ORDER BY total DESC, v.name ASC
				 LIMIT 3`,
				[start, end],
			),
			client.query(
				`SELECT COALESCE(m.name, 'Unassigned') AS name, COUNT(*)::int AS total
				 FROM "VenueRequest" vr
				 LEFT JOIN "Ministry" m ON m.id = vr."ministryId"
				 WHERE vr."startDateTime" >= $1
				   AND vr."startDateTime" < $2
				   AND vr.status <> 'REJECTED'
				 GROUP BY COALESCE(m.name, 'Unassigned')
				 ORDER BY total DESC, name ASC
				 LIMIT 3`,
				[start, end],
			),
			client.query(
				`SELECT COALESCE(NULLIF(BTRIM(vr.purpose), ''), NULLIF(BTRIM(vr."eventName"), ''), 'Unspecified') AS name, COUNT(*)::int AS total
				 FROM "VenueRequest" vr
				 WHERE vr."startDateTime" >= $1
				   AND vr."startDateTime" < $2
				   AND vr.status <> 'REJECTED'
				 GROUP BY COALESCE(NULLIF(BTRIM(vr.purpose), ''), NULLIF(BTRIM(vr."eventName"), ''), 'Unspecified')
				 ORDER BY total DESC, name ASC
				 LIMIT 3`,
				[start, end],
			),
			venueId
				? client.query(
					`SELECT COUNT(*)::int AS total
					 FROM "VenueRequest"
					 WHERE "venueId" = $1
					   AND "startDateTime" >= $2
					   AND "startDateTime" < $3
					   AND status <> 'REJECTED'`,
					[venueId, start, end],
				)
				: Promise.resolve({ rows: [] as Array<{ total: number }> }),
			ministryId
				? client.query(
					`SELECT COUNT(*)::int AS total
					 FROM "VenueRequest"
					 WHERE "ministryId" = $1
					   AND "startDateTime" >= $2
					   AND "startDateTime" < $3
					   AND status <> 'REJECTED'`,
					[ministryId, start, end],
				)
				: Promise.resolve({ rows: [] as Array<{ total: number }> }),
		]);

		const totalRequestsResult = await client.query(
			`SELECT COUNT(*)::int AS total
			 FROM "VenueRequest"
			 WHERE "startDateTime" >= $1
			   AND "startDateTime" < $2
			   AND status <> 'REJECTED'`,
			[start, end],
		);

		const topVenues = venuesResult.rows.map((row) => ({ name: row.name as string, total: row.total as number }));
		const topMinistries = ministriesResult.rows.map((row) => ({ name: row.name as string, total: row.total as number }));
		const topPurposes = purposesResult.rows.map((row) => ({ name: row.name as string, total: row.total as number }));
		const totalRequests = totalRequestsResult.rows[0]?.total ?? 0;

		const recommendations: string[] = [];
		recommendations.push(
			totalRequests > 0
				? `${monthLabel} already has ${totalRequests} live booking${totalRequests === 1 ? "" : "s"}.`
				: `No live bookings were found for ${monthLabel} yet.`,
		);

		if (topVenues.length > 0) {
			recommendations.push(`Most active venues this month: ${formatCountList(topVenues).join(", ")}.`);
		}

		if (topMinistries.length > 0) {
			recommendations.push(`Most active ministries this month: ${formatCountList(topMinistries).join(", ")}.`);
		}

		if (topPurposes.length > 0) {
			recommendations.push(`Common live activities this month: ${formatCountList(topPurposes).join(", ")}.`);
		}

		if (selectedVenueResult.rows[0]?.total) {
			recommendations.push(`The selected venue has ${selectedVenueResult.rows[0].total} booking${selectedVenueResult.rows[0].total === 1 ? "" : "s"} in ${monthLabel}.`);
		}

		if (selectedMinistryResult.rows[0]?.total) {
			recommendations.push(`The selected ministry has ${selectedMinistryResult.rows[0].total} booking${selectedMinistryResult.rows[0].total === 1 ? "" : "s"} in ${monthLabel}.`);
		}

		return res.json({
			monthLabel,
			monthName,
			totalRequests,
			seasonalContext,
			topVenues,
			topMinistries,
			topPurposes,
			recommendations,
		});
	} catch (error) {
		if (error instanceof AppError) {
			return next(error);
		}

		return next(new AppError("Failed to build booking recommendations", 500));
	} finally {
		client.release();
	}
}

export async function getPriests(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const client = await pool.connect();
	try {
		const result = await client.query(
			`SELECT id, name, email
			 FROM "User"
			 WHERE role = 'PARISH_PRIEST'
			 ORDER BY name ASC, email ASC`,
		);

		return res.json({
			priests: result.rows.map((row) => ({
				id: row.id,
				name: row.name,
				email: row.email,
			})),
		});
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export default {
	evaluateRequest,
	checkConflicts,
	getBookingRecommendations,
	getPriests,
};
