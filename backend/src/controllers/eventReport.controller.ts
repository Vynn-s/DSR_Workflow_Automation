import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { pool } from "../config/database";

const { z } = require("zod") as typeof import("zod");
const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

const requestIdParamsSchema = z.object({ requestId: z.string().min(1) });
const reportBodySchema = z.object({ report: z.string().trim().min(10).max(2000) });
const listQuerySchema = z.object({ requestId: z.string().min(1).optional() });

function mapReportRow(row: Record<string, any>) {
	return {
		id: row.id,
		requestId: row.requestId,
		reportedById: row.reportedById,
		report: row.report,
		submittedAt: row.submittedAt,
		updatedAt: row.updatedAt,
		request: row.eventName ? {
			id: row.requestId,
			eventName: row.eventName,
			purpose: row.purpose,
			endDateTime: row.endDateTime,
			venue: row.venueName ? { name: row.venueName } : null,
			requester: row.requesterName ? { name: row.requesterName } : null,
		} : undefined,
		reportedBy: row.reporterName ? { id: row.reportedById, name: row.reporterName } : undefined,
	};
}

async function insertAuditLog(client: import("pg").PoolClient, input: {
	requestId: string;
	performedById: string;
	action: string;
	details: Record<string, unknown>;
	ipAddress?: string;
}) {
	await client.query(
		`INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
		 VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())`,
		[randomUUID(), input.requestId, input.performedById, input.action, JSON.stringify(input.details), input.ipAddress],
	);
}

export async function createEventReport(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user?.id || req.user.role !== "REQUESTER") throw new AppError("Insufficient permissions", 403);
		const params = requestIdParamsSchema.safeParse(req.params);
		const body = reportBodySchema.safeParse(req.body);
		if (!params.success) throw new AppError("Invalid request id", 400);
		if (!body.success) throw new AppError("Report must be between 10 and 2000 characters", 400);

		await client.query("BEGIN");
		const requestResult = await client.query(
			`SELECT id, "requesterId", status, "endDateTime", "eventName", purpose FROM "VenueRequest" WHERE id = $1 FOR UPDATE`,
			[params.data.requestId],
		);
		const request = requestResult.rows[0];
		if (!request) throw new AppError("Request not found", 404);
		if (request.requesterId !== req.user.id) throw new AppError("Insufficient permissions", 403);
		if (request.status !== "APPROVED") throw new AppError("Only approved requests can receive event reports", 400);
		if (new Date(request.endDateTime).getTime() > Date.now()) throw new AppError("Cannot submit report before the event ends", 400);

		const existing = await client.query(`SELECT id FROM "EventReport" WHERE "requestId" = $1`, [request.id]);
		if (existing.rows.length > 0) throw new AppError("Event report already submitted", 409);

		const created = await client.query(
			`INSERT INTO "EventReport" (id, "requestId", "reportedById", report, "submittedAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, "requestId", "reportedById", report, "submittedAt", "updatedAt"`,
			[randomUUID(), request.id, req.user.id, body.data.report],
		);
		await insertAuditLog(client, {
			requestId: request.id,
			performedById: req.user.id,
			action: "EVENT_REPORT_SUBMITTED",
			details: { requestId: request.id, eventName: request.eventName, purpose: request.purpose },
			ipAddress: req.ip,
		});
		await client.query("COMMIT");
		return res.status(201).json({ report: mapReportRow(created.rows[0]) });
	} catch (error) {
		await client.query("ROLLBACK").catch(() => undefined);
		return next(error);
	} finally {
		client.release();
	}
}

export async function updateEventReport(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user?.id || req.user.role !== "REQUESTER") throw new AppError("Insufficient permissions", 403);
		const params = requestIdParamsSchema.safeParse(req.params);
		const body = reportBodySchema.safeParse(req.body);
		if (!params.success) throw new AppError("Invalid request id", 400);
		if (!body.success) throw new AppError("Report must be between 10 and 2000 characters", 400);

		await client.query("BEGIN");
		const existing = await client.query(
			`SELECT er.id, er."requestId", er."reportedById", er."submittedAt", vr."eventName", vr.purpose
			 FROM "EventReport" er INNER JOIN "VenueRequest" vr ON vr.id = er."requestId"
			 WHERE er."requestId" = $1 FOR UPDATE`,
			[params.data.requestId],
		);
		const report = existing.rows[0];
		if (!report) throw new AppError("Event report not found", 404);
		if (report.reportedById !== req.user.id) throw new AppError("Insufficient permissions", 403);
		if (Date.now() - new Date(report.submittedAt).getTime() > 24 * 60 * 60 * 1000) throw new AppError("Event report can only be edited within 24 hours", 400);

		const updated = await client.query(
			`UPDATE "EventReport" SET report = $1, "updatedAt" = NOW() WHERE "requestId" = $2
			 RETURNING id, "requestId", "reportedById", report, "submittedAt", "updatedAt"`,
			[body.data.report, params.data.requestId],
		);
		await insertAuditLog(client, {
			requestId: params.data.requestId,
			performedById: req.user.id,
			action: "EVENT_REPORT_UPDATED",
			details: { requestId: params.data.requestId, eventName: report.eventName, purpose: report.purpose },
			ipAddress: req.ip,
		});
		await client.query("COMMIT");
		return res.json({ report: mapReportRow(updated.rows[0]) });
	} catch (error) {
		await client.query("ROLLBACK").catch(() => undefined);
		return next(error);
	} finally {
		client.release();
	}
}

export async function getEventReport(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user) throw new AppError("Unauthorized", 401);
		const params = requestIdParamsSchema.safeParse(req.params);
		if (!params.success) throw new AppError("Invalid request id", 400);
		const result = await client.query(
			`SELECT er.id, er."requestId", er."reportedById", er.report, er."submittedAt", er."updatedAt",
				vr."requesterId", vr."eventName", vr.purpose, vr."endDateTime", v.name AS "venueName", u.name AS "requesterName", reporter.name AS "reporterName"
			 FROM "EventReport" er
			 INNER JOIN "VenueRequest" vr ON vr.id = er."requestId"
			 INNER JOIN "Venue" v ON v.id = vr."venueId"
			 INNER JOIN "User" u ON u.id = vr."requesterId"
			 INNER JOIN "User" reporter ON reporter.id = er."reportedById"
			 WHERE er."requestId" = $1`,
			[params.data.requestId],
		);
		const report = result.rows[0];
		if (!report) return res.status(404).json({ report: null });
		if (req.user.role === "REQUESTER" && report.requesterId !== req.user.id) throw new AppError("Insufficient permissions", 403);
		if (!["REQUESTER", "PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"].includes(req.user.role)) throw new AppError("Insufficient permissions", 403);
		return res.json({ report: mapReportRow(report) });
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function listEventReports(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user || !["PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"].includes(req.user.role)) throw new AppError("Insufficient permissions", 403);
		const query = listQuerySchema.safeParse(req.query);
		if (!query.success) throw new AppError("Invalid report query", 400);
		const values: string[] = [];
		let where = "";
		if (query.data.requestId) {
			values.push(query.data.requestId);
			where = `WHERE er."requestId" = $1`;
		}
		const result = await client.query(
			`SELECT er.id, er."requestId", er."reportedById", er.report, er."submittedAt", er."updatedAt",
				vr."eventName", vr.purpose, vr."endDateTime", v.name AS "venueName", u.name AS "requesterName", reporter.name AS "reporterName"
			 FROM "EventReport" er
			 INNER JOIN "VenueRequest" vr ON vr.id = er."requestId"
			 INNER JOIN "Venue" v ON v.id = vr."venueId"
			 INNER JOIN "User" u ON u.id = vr."requesterId"
			 INNER JOIN "User" reporter ON reporter.id = er."reportedById"
			 ${where}
			 ORDER BY er."submittedAt" DESC`,
			values,
		);
		return res.json({ reports: result.rows.map(mapReportRow) });
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}
