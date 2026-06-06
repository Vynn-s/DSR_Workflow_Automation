"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRequest = evaluateRequest;
exports.checkConflicts = checkConflicts;
exports.getBookingRecommendations = getBookingRecommendations;
exports.getPriests = getPriests;
const crypto_1 = require("crypto");
const database_1 = require("../config/database");
const { z } = require("zod");
const { evaluateRequest: runDssEvaluation, } = require("../dss/rulesEngine");
const { AppError } = require("../middleware/errorHandler");
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const signatureSchema = z.object({
    required: z.boolean().optional(),
    status: z.preprocess((value) => String(value ?? "pending").toLowerCase() === "signed" ? "signed" : "pending", z.enum(["pending", "signed"])),
}).passthrough();
const evaluateRequestSchema = z.object({
    venueId: z.string().min(1).optional(),
    ministryId: z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional()),
    requestId: z.string().min(1).optional(),
    requestDate: z.coerce.date().optional(),
    startTime: z.string().regex(timePattern).optional(),
    endTime: z.string().regex(timePattern).optional(),
    attendees: z.coerce.number().int().positive().optional(),
    attachmentCount: z.coerce.number().int().nonnegative().optional(),
    signatures: z.preprocess((value) => Array.isArray(value) ? value.filter((entry) => entry && typeof entry === "object") : [], z.array(signatureSchema)).optional(),
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
function combineDateAndTime(date, time) {
    const [hours, minutes] = time.split(":").map((value) => Number(value));
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
}
function formatTimeForDss(value) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}
function getMonthWindow(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
}
function formatCountList(entries) {
    return entries.map((entry) => `${entry.name} (${entry.total})`);
}
function formatTimeForResponse(value) {
    return value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function formatDateForResponse(value) {
    return value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function buildNextAvailableSlot(requestedStartDateTime, requestedEndDateTime, conflicts) {
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
function getSeasonalContext(monthName) {
    const seasonalNotes = {
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
async function evaluateRequest(req, res, next) {
    const client = await database_1.pool.connect();
    try {
        const parsed = evaluateRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new AppError("Invalid request payload for DSS evaluation", 400);
        }
        if (!req.user?.id) {
            throw new AppError("Unauthorized", 401);
        }
        let { venueId, ministryId, requestId, requestDate, startTime, endTime, attendees } = parsed.data;
        let attachmentCount = parsed.data.attachmentCount ?? 0;
        let signatures = parsed.data.signatures ?? [];
        const userResult = await client.query(`SELECT id, "ministryId" FROM "User" WHERE email = $1 LIMIT 1`, [req.user.email]);
        if (userResult.rows.length === 0) {
            throw new AppError("User not found", 404);
        }
        const actorUserId = userResult.rows[0].id;
        if (requestId) {
            const requestResult = await client.query(`SELECT id, "venueId", "ministryId", "startDateTime", "endDateTime", attendees, attachments, signatures
				 FROM "VenueRequest"
				 WHERE id = $1
				 LIMIT 1`, [requestId]);
            if (requestResult.rows.length === 0) {
                throw new AppError("Request not found", 404);
            }
            const requestRecord = requestResult.rows[0];
            venueId = requestRecord.venueId;
            ministryId = requestRecord.ministryId;
            requestDate = requestRecord.startDateTime;
            startTime = formatTimeForDss(requestRecord.startDateTime);
            endTime = formatTimeForDss(requestRecord.endDateTime);
            attendees = requestRecord.attendees;
            attachmentCount = Array.isArray(requestRecord.attachments) ? requestRecord.attachments.length : attachmentCount;
            const parsedSignatures = evaluateRequestSchema.shape.signatures.safeParse(requestRecord.signatures);
            signatures = parsedSignatures.success ? parsedSignatures.data ?? [] : [];
        }
        if (!venueId || !requestDate || !startTime || !endTime || !attendees) {
            throw new AppError("Invalid request payload for DSS evaluation", 400);
        }
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
        const conflictParams = [venueId, requestedEndDateTime, requestedStartDateTime];
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
            conflictQuery += ` AND vr.id <> $4`;
            conflictParams.push(requestId);
        }
        conflictQuery += ` ORDER BY vr."startDateTime" ASC`;
        const conflictsResult = await client.query(conflictQuery, conflictParams);
        const decision = runDssEvaluation({
            venueId,
            ministryId,
            requestId,
            requestDate,
            startTime,
            endTime,
            attendees,
            signatures,
            attachmentCount,
        }, venue.capacity, authorizedMinistriesResult.rows.map((entry) => entry.ministryId), conflictsResult.rows.length > 0);
        const conflictDetails = conflictsResult.rows.map((row) => ({
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
        let ministryName = null;
        if (ministryId) {
            const mres = await client.query(`SELECT name FROM "Ministry" WHERE id = $1`, [ministryId]);
            ministryName = mres.rows[0]?.name ?? null;
        }
        await client.query(`INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`, [
            (0, crypto_1.randomUUID)(),
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
        ]);
        return res.json(enrichedDecision);
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
    const client = await database_1.pool.connect();
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
async function getBookingRecommendations(req, res, next) {
    const client = await database_1.pool.connect();
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
            client.query(`SELECT v.name, COUNT(*)::int AS total
				 FROM "VenueRequest" vr
				 INNER JOIN "Venue" v ON v.id = vr."venueId"
				 WHERE vr."startDateTime" >= $1
				   AND vr."startDateTime" < $2
				   AND vr.status <> 'REJECTED'
				 GROUP BY v.name
				 ORDER BY total DESC, v.name ASC
				 LIMIT 3`, [start, end]),
            client.query(`SELECT COALESCE(m.name, 'Unassigned') AS name, COUNT(*)::int AS total
				 FROM "VenueRequest" vr
				 LEFT JOIN "Ministry" m ON m.id = vr."ministryId"
				 WHERE vr."startDateTime" >= $1
				   AND vr."startDateTime" < $2
				   AND vr.status <> 'REJECTED'
				 GROUP BY COALESCE(m.name, 'Unassigned')
				 ORDER BY total DESC, name ASC
				 LIMIT 3`, [start, end]),
            client.query(`SELECT COALESCE(NULLIF(BTRIM(vr.purpose), ''), NULLIF(BTRIM(vr."eventName"), ''), 'Unspecified') AS name, COUNT(*)::int AS total
				 FROM "VenueRequest" vr
				 WHERE vr."startDateTime" >= $1
				   AND vr."startDateTime" < $2
				   AND vr.status <> 'REJECTED'
				 GROUP BY COALESCE(NULLIF(BTRIM(vr.purpose), ''), NULLIF(BTRIM(vr."eventName"), ''), 'Unspecified')
				 ORDER BY total DESC, name ASC
				 LIMIT 3`, [start, end]),
            venueId
                ? client.query(`SELECT COUNT(*)::int AS total
					 FROM "VenueRequest"
					 WHERE "venueId" = $1
					   AND "startDateTime" >= $2
					   AND "startDateTime" < $3
					   AND status <> 'REJECTED'`, [venueId, start, end])
                : Promise.resolve({ rows: [] }),
            ministryId
                ? client.query(`SELECT COUNT(*)::int AS total
					 FROM "VenueRequest"
					 WHERE "ministryId" = $1
					   AND "startDateTime" >= $2
					   AND "startDateTime" < $3
					   AND status <> 'REJECTED'`, [ministryId, start, end])
                : Promise.resolve({ rows: [] }),
        ]);
        const totalRequestsResult = await client.query(`SELECT COUNT(*)::int AS total
			 FROM "VenueRequest"
			 WHERE "startDateTime" >= $1
			   AND "startDateTime" < $2
			   AND status <> 'REJECTED'`, [start, end]);
        const topVenues = venuesResult.rows.map((row) => ({ name: row.name, total: row.total }));
        const topMinistries = ministriesResult.rows.map((row) => ({ name: row.name, total: row.total }));
        const topPurposes = purposesResult.rows.map((row) => ({ name: row.name, total: row.total }));
        const totalRequests = totalRequestsResult.rows[0]?.total ?? 0;
        const recommendations = [];
        recommendations.push(totalRequests > 0
            ? `${monthLabel} already has ${totalRequests} live booking${totalRequests === 1 ? "" : "s"}.`
            : `No live bookings were found for ${monthLabel} yet.`);
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
    }
    catch (error) {
        if (error instanceof AppError) {
            return next(error);
        }
        return next(new AppError("Failed to build booking recommendations", 500));
    }
    finally {
        client.release();
    }
}
async function getPriests(req, res, next) {
    const client = await database_1.pool.connect();
    try {
        const result = await client.query(`SELECT id, name, email
			 FROM "User"
			 WHERE role = 'PARISH_PRIEST'
			 ORDER BY name ASC, email ASC`);
        return res.json({
            priests: result.rows.map((row) => ({
                id: row.id,
                name: row.name,
                email: row.email,
            })),
        });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
exports.default = {
    evaluateRequest,
    checkConflicts,
    getBookingRecommendations,
    getPriests,
};
//# sourceMappingURL=dss.controller.js.map