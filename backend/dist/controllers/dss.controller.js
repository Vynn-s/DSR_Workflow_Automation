"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRequest = evaluateRequest;
exports.checkConflicts = checkConflicts;
const crypto_1 = require("crypto");
const pg_1 = require("pg");
const { z } = require("zod");
const { evaluateRequest: runDssEvaluation, } = require("../dss/rulesEngine");
const { AppError } = require("../middleware/errorHandler");
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
let pool = null;
function getPool() {
    if (pool)
        return pool;
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new AppError("Missing required environment variable: DATABASE_URL", 500);
    }
    pool = new pg_1.Pool({
        connectionString,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : true,
    });
    return pool;
}
function combineDateAndTime(date, time) {
    const [hours, minutes] = time.split(":").map((value) => Number(value));
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
}
async function evaluateRequest(req, res, next) {
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
        const userResult = await client.query(`SELECT id, "ministryId" FROM "User" WHERE email = $1 LIMIT 1`, [req.user.email]);
        if (userResult.rows.length === 0) {
            throw new AppError("User not found", 404);
        }
        const actorUserId = userResult.rows[0].id;
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
        const venueResult = await client.query(`SELECT id, capacity FROM "Venue" WHERE id = $1`, [venueId]);
        if (venueResult.rows.length === 0) {
            throw new AppError("Venue not found", 404);
        }
        const venue = venueResult.rows[0];
        const authorizedMinistriesResult = await client.query(`SELECT "ministryId" FROM "VenueMinistry" WHERE "venueId" = $1`, [venueId]);
        const conflictsResult = await client.query(`SELECT id FROM "VenueRequest"
			 WHERE "venueId" = $1
			 AND status <> 'REJECTED'
			 AND "startDateTime" < $2
			 AND "endDateTime" > $3`, [venueId, requestedEndDateTime, requestedStartDateTime]);
        const decision = runDssEvaluation({
            venueId,
            ministryId,
            requestDate,
            startTime,
            endTime,
            attendees,
        }, venue.capacity, authorizedMinistriesResult.rows.map((entry) => entry.ministryId), conflictsResult.rows.length > 0);
        await client.query(`INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`, [
            (0, crypto_1.randomUUID)(),
            null,
            actorUserId,
            "DSS_EVALUATION",
            JSON.stringify({
                venueId,
                ministryId,
                hasConflict: conflictsResult.rows.length > 0,
                decision,
            }),
            req.ip,
        ]);
        return res.json(decision);
    }
    catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        return next(new AppError("Failed to evaluate DSS request", 500));
    }
    finally {
        client.release();
    }
}
async function checkConflicts(req, res, next) {
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
        const conflictsResult = await client.query(`SELECT id, "eventName", purpose, "startDateTime", "endDateTime", status, attendees
			 FROM "VenueRequest"
			 WHERE "venueId" = $1
			 AND status <> 'REJECTED'
			 AND "startDateTime" < $2
			 AND "endDateTime" > $3
			 ORDER BY "startDateTime" ASC`, [venueId, requestedEndDateTime, requestedStartDateTime]);
        return res.json({
            conflicts: conflictsResult.rows,
        });
    }
    catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        return next(new AppError("Failed to check scheduling conflicts", 500));
    }
    finally {
        client.release();
    }
}
exports.default = {
    evaluateRequest,
    checkConflicts,
};
//# sourceMappingURL=dss.controller.js.map