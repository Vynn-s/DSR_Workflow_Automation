"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequest = createRequest;
exports.getRequests = getRequests;
exports.getRequestById = getRequestById;
exports.cancelRequest = cancelRequest;
exports.getAvailability = getAvailability;
const crypto_1 = require("crypto");
const pg_1 = require("pg");
const { z } = require("zod");
const { evaluateRequest: runDssEvaluation, } = require("../dss/rulesEngine");
const { AppError } = require("../middleware/errorHandler");
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
const createRequestSchema = z.object({
    venueId: z.string().min(1),
    ministryId: z.string().min(1).optional(),
    eventName: z.string().min(1),
    purpose: z.string().min(1),
    startDateTime: z.coerce.date(),
    endDateTime: z.coerce.date(),
    attendees: z.coerce.number().int().positive(),
    specialRequirements: z.string().optional(),
    attachments: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        size: z.string(),
        uploadedDate: z.string(),
        dataUrl: z.string(),
    })).optional(),
    signatures: z.array(z.object({
        role: z.string(),
        signatory: z.string(),
        required: z.boolean(),
        status: z.enum(["pending", "signed"]),
        signedDate: z.string().optional(),
    })).optional(),
});
const requestIdParamsSchema = z.object({
    id: z.string().min(1),
});
function toTimeString(date) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}
async function createRequest(req, res, next) {
    const client = await getPool().connect();
    try {
        if (!req.user?.id) {
            throw new AppError("Unauthorized", 401);
        }
        const parsed = createRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            console.error("Validation errors:", parsed.error.issues);
            throw new AppError(`Invalid request payload: ${parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`, 400);
        }
        const input = parsed.data;
        const attachments = input.attachments ?? [];
        const signatures = input.signatures ?? [];
        if (input.endDateTime <= input.startDateTime) {
            throw new AppError("endDateTime must be later than startDateTime", 400);
        }
        let ministryId = input.ministryId;
        if (!ministryId) {
            const ministryResult = await client.query(`SELECT "ministryId" FROM "User" WHERE id = $1`, [req.user.id]);
            ministryId = ministryResult.rows[0]?.ministryId;
            if (!ministryId) {
                throw new AppError("User ministry not found. Please contact an administrator.", 400);
            }
        }
        const venueResult = await client.query(`SELECT id, capacity FROM "Venue" WHERE id = $1`, [input.venueId]);
        if (venueResult.rows.length === 0) {
            throw new AppError("Venue not found", 404);
        }
        const venue = venueResult.rows[0];
        const authorizedMinistriesResult = await client.query(`SELECT "ministryId" FROM "VenueMinistry" WHERE "venueId" = $1`, [input.venueId]);
        const conflictsResult = await client.query(`SELECT id FROM "VenueRequest"
			 WHERE "venueId" = $1
			 AND status <> 'REJECTED'
			 AND "startDateTime" < $2
			 AND "endDateTime" > $3`, [input.venueId, input.endDateTime, input.startDateTime]);
        const dssDecision = runDssEvaluation({
            venueId: input.venueId,
            ministryId: ministryId,
            requestDate: input.startDateTime,
            startTime: toTimeString(input.startDateTime),
            endTime: toTimeString(input.endDateTime),
            attendees: input.attendees,
        }, venue.capacity, authorizedMinistriesResult.rows.map((entry) => entry.ministryId), conflictsResult.rows.length > 0);
        if (!dssDecision.canProceed) {
            throw new AppError(`DSS evaluation failed: ${dssDecision.recommendation}`, 400);
        }
        const secretaryResult = await client.query(`SELECT id FROM "User" WHERE role = 'PARISH_SECRETARY' ORDER BY "createdAt" ASC LIMIT 1`);
        if (secretaryResult.rows.length === 0) {
            throw new AppError("No PARISH_SECRETARY approver configured", 500);
        }
        const secretaryId = secretaryResult.rows[0].id;
        const requestId = (0, crypto_1.randomUUID)();
        await client.query(`INSERT INTO "VenueRequest" (
				id, "requesterId", "venueId", "ministryId", "eventName", purpose,
				"startDateTime", "endDateTime", attendees, "specialRequirements", attachments, signatures,
				status, "currentApproverId", "createdAt", "updatedAt"
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::"RequestStatus",$14,NOW(),NOW())`, [
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
            JSON.stringify(attachments),
            JSON.stringify(signatures),
            "PENDING",
            secretaryId,
        ]);
        await client.query(`INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`, [
            (0, crypto_1.randomUUID)(),
            requestId,
            req.user.id,
            "REQUEST_CREATED",
            JSON.stringify({
                requestId,
                dssDecision,
            }),
            req.ip,
        ]);
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
            attachments,
            signatures,
            status: "PENDING",
            currentApproverId: secretaryId,
        });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
async function getRequests(req, res, next) {
    const client = await getPool().connect();
    try {
        if (!req.user) {
            throw new AppError("Unauthorized", 401);
        }
        const requestsResult = await client.query(`SELECT
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
				vr.attachments,
				vr.signatures,
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
			 ORDER BY vr."createdAt" DESC`, [req.user.id]);
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
            attachments: request.attachments ?? [],
            signatures: request.signatures ?? [],
        }));
        return res.json({ requests });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
async function getRequestById(req, res, next) {
    const client = await getPool().connect();
    try {
        if (!req.user) {
            throw new AppError("Unauthorized", 401);
        }
        const parsedParams = requestIdParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            throw new AppError("Invalid request id", 400);
        }
        const requestResult = await client.query(`SELECT
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
				vr.attachments,
				vr.signatures,
				vr.status,
				vr."currentApproverId",
				vr."createdAt",
				vr."updatedAt",
				v.name AS venue_name,
				v.description AS venue_description,
				v.capacity AS venue_capacity,
				m.name AS ministry_name,
				u.name AS requester_name,
				u.email AS requester_email,
				ca.name AS current_approver_name,
				ca.email AS current_approver_email
			 FROM "VenueRequest" vr
			 INNER JOIN "Venue" v ON v.id = vr."venueId"
			 INNER JOIN "Ministry" m ON m.id = vr."ministryId"
			 INNER JOIN "User" u ON u.id = vr."requesterId"
			 LEFT JOIN "User" ca ON ca.id = vr."currentApproverId"
			 WHERE vr.id = $1`, [parsedParams.data.id]);
        if (requestResult.rows.length === 0) {
            throw new AppError("Request not found", 404);
        }
        const requestRecord = requestResult.rows[0];
        if (req.user.role === "REQUESTER" && requestRecord.requesterId !== req.user.id) {
            throw new AppError("Insufficient permissions", 403);
        }
        const approvalActionsResult = await client.query(`SELECT
				aa.id,
				aa."requestId",
				aa."approverId",
				aa.action,
				aa.remarks,
				aa."createdAt",
				u.name AS approver_name,
				u.email AS approver_email
			 FROM "ApprovalAction" aa
			 INNER JOIN "User" u ON u.id = aa."approverId"
			 WHERE aa."requestId" = $1
			 ORDER BY aa."createdAt" ASC`, [requestRecord.id]);
        return res.json({
            ...requestRecord,
            venue: {
                id: requestRecord.venueId,
                name: requestRecord.venue_name,
                description: requestRecord.venue_description,
                capacity: requestRecord.venue_capacity,
            },
            ministry: {
                id: requestRecord.ministryId,
                name: requestRecord.ministry_name,
            },
            requester: {
                id: requestRecord.requesterId,
                name: requestRecord.requester_name,
                email: requestRecord.requester_email,
            },
            currentApprover: requestRecord.currentApproverId
                ? {
                    id: requestRecord.currentApproverId,
                    name: requestRecord.current_approver_name,
                    email: requestRecord.current_approver_email,
                }
                : null,
            approvalActions: approvalActionsResult.rows.map((action) => ({
                id: action.id,
                requestId: action.requestId,
                approverId: action.approverId,
                action: action.action,
                remarks: action.remarks,
                createdAt: action.createdAt,
                approver: {
                    id: action.approverId,
                    name: action.approver_name,
                    email: action.approver_email,
                },
            })),
            attachments: requestRecord.attachments ?? [],
            signatures: requestRecord.signatures ?? [],
        });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
async function cancelRequest(req, res, next) {
    const client = await getPool().connect();
    try {
        if (!req.user) {
            throw new AppError("Unauthorized", 401);
        }
        const parsedParams = requestIdParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            throw new AppError("Invalid request id", 400);
        }
        const existingRequestResult = await client.query(`SELECT id, "requesterId", status FROM "VenueRequest" WHERE id = $1`, [parsedParams.data.id]);
        if (existingRequestResult.rows.length === 0) {
            throw new AppError("Request not found", 404);
        }
        const existingRequest = existingRequestResult.rows[0];
        if (existingRequest.requesterId !== req.user.id) {
            throw new AppError("Insufficient permissions", 403);
        }
        if (existingRequest.status !== "PENDING") {
            throw new AppError("Only PENDING requests can be cancelled", 400);
        }
        await client.query(`UPDATE "VenueRequest"
			 SET status = 'REJECTED', "currentApproverId" = NULL, "updatedAt" = NOW()
			 WHERE id = $1`, [existingRequest.id]);
        await client.query(`INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
			 VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`, [
            (0, crypto_1.randomUUID)(),
            existingRequest.id,
            req.user.id,
            "REQUEST_CANCELLED",
            JSON.stringify({
                previousStatus: existingRequest.status,
                nextStatus: "REJECTED",
            }),
            req.ip,
        ]);
        return res.json({
            id: existingRequest.id,
            status: "REJECTED",
            currentApproverId: null,
        });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
async function getAvailability(req, res, next) {
    const client = await getPool().connect();
    try {
        if (!req.user) {
            throw new AppError("Unauthorized", 401);
        }
        const requestsResult = await client.query(`SELECT
				vr.id,
				vr."requesterId",
				vr."venueId",
				vr."ministryId",
				vr."eventName",
				vr.purpose,
				vr."startDateTime",
				vr."endDateTime",
				vr.attendees,
				vr.status,
				vr."createdAt",
				vr."updatedAt",
				v.name AS venue_name,
				m.name AS ministry_name,
				u.name AS requester_name,
				u.email AS requester_email
			 FROM "VenueRequest" vr
			 INNER JOIN "Venue" v ON v.id = vr."venueId"
			 INNER JOIN "Ministry" m ON m.id = vr."ministryId"
			 INNER JOIN "User" u ON u.id = vr."requesterId"
			 WHERE vr.status IN ('APPROVED', 'PENDING')
			 ORDER BY vr."startDateTime" ASC`);
        const approvalActionsResult = await client.query(`SELECT
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
			 ORDER BY aa."createdAt" ASC`, [requestsResult.rows.map((row) => row.id)]);
        const approvalActionsByRequestId = new Map();
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
        const requests = requestsResult.rows.map((request) => ({
            id: request.id,
            eventName: request.eventName,
            purpose: request.purpose,
            startDateTime: request.startDateTime,
            endDateTime: request.endDateTime,
            status: request.status,
            attendees: request.attendees,
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
        return res.json({ requests });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
exports.default = {
    createRequest,
    getRequests,
    getRequestById,
    cancelRequest,
    getAvailability,
};
//# sourceMappingURL=request.controller.js.map