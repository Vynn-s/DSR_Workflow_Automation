import type { NextFunction, Request, Response } from "express";
import { Pool } from "pg";

const { z } = require("zod") as typeof import("zod");

const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

type AuditQueryFilters = {
	dateFrom?: Date;
	dateTo?: Date;
	action?: string;
	role?: "REQUESTER" | "APPROVER" | "ADMIN";
	venueId?: string;
	requestId?: string;
	page?: number;
	limit?: number;
};

type AuditStatsFilters = Omit<AuditQueryFilters, "page" | "limit">;

const auditQuerySchema = z.object({
	dateFrom: z.coerce.date().optional(),
	dateTo: z.coerce.date().optional(),
	action: z.string().min(1).optional(),
	role: z.enum(["REQUESTER", "APPROVER", "ADMIN"]).optional(),
	venueId: z.string().min(1).optional(),
	requestId: z.string().min(1).optional(),
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

let pool: Pool | null = null;

function getPool(): Pool {
	if (pool) {
		return pool;
	}

	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error("Missing required environment variable: DATABASE_URL");
	}

	pool = new Pool({
		connectionString,
		ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : true,
	});

	return pool;
}

function startOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function startOfWeek(date: Date): Date {
	const copy = new Date(date);
	const day = copy.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	copy.setDate(copy.getDate() + diff);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

function parseJsonDetails(details: unknown): Record<string, unknown> | null {
	if (!details) {
		return null;
	}

	if (typeof details === "object") {
		return details as Record<string, unknown>;
	}

	if (typeof details === "string") {
		try {
			return JSON.parse(details) as Record<string, unknown>;
		} catch {
			return { raw: details };
		}
	}

	return null;
}

function toNumber(value: unknown): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function buildWhereClause(
	filters: AuditQueryFilters,
	values: Array<string | number | Date>,
): string {
	const clauses: string[] = [];

	if (filters.dateFrom) {
		values.push(filters.dateFrom);
		clauses.push(`al."createdAt" >= $${values.length}`);
	}

	if (filters.dateTo) {
		values.push(filters.dateTo);
		clauses.push(`al."createdAt" < $${values.length}`);
	}

	if (filters.action) {
		values.push(filters.action);
		clauses.push(`al.action = $${values.length}`);
	}

	if (filters.role) {
		if (filters.role === "APPROVER") {
			values.push("PARISH_SECRETARY", "PARISH_PRIEST");
			clauses.push(`u.role IN ($${values.length - 1}, $${values.length})`);
		} else if (filters.role === "ADMIN") {
			values.push("ADMIN");
			clauses.push(`u.role = $${values.length}`);
		} else {
			values.push("REQUESTER");
			clauses.push(`u.role = $${values.length}`);
		}
	}

	if (filters.venueId) {
		values.push(filters.venueId);
		clauses.push(`vr."venueId" = $${values.length}`);
	}

	if (filters.requestId) {
		values.push(filters.requestId);
		clauses.push(`al."requestId" = $${values.length}`);
	}

	return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
}

function mapAuditRow(row: Record<string, any>) {
	const details = parseJsonDetails(row.details);

	return {
		id: row.id,
		action: row.action,
		createdAt: row.createdAt,
		ipAddress: row.ipAddress ?? null,
		details,
		performedBy: {
			id: row.performed_by_id,
			name: row.performed_by_name,
			email: row.performed_by_email,
			role: row.performed_by_role,
		},
		venueRequest: row.request_id
			? {
				id: row.request_id,
				eventName: row.request_event_name,
				purpose: row.request_purpose,
				startDateTime: row.request_start_date_time,
				endDateTime: row.request_end_date_time,
				attendees: row.request_attendees,
				status: row.request_status,
				venue: row.venue_id
					? {
						id: row.venue_id,
						name: row.venue_name,
					}
					: null,
				requester: row.requester_id
					? {
						id: row.requester_id,
						name: row.requester_name,
						email: row.requester_email,
					}
					: null,
				ministry: row.ministry_id
					? {
						id: row.ministry_id,
						name: row.ministry_name,
					}
					: null,
			}
			: null,
	};
}

function buildWeeklyRequestVolume(logRows: Array<{ created_at: string }>) {
	const currentWeekStart = startOfWeek(new Date());
	const buckets = Array.from({ length: 6 }, (_, index) => {
		const start = new Date(currentWeekStart);
		start.setDate(start.getDate() - (5 - index) * 7);
		const end = new Date(start);
		end.setDate(end.getDate() + 7);
		return {
			weekStart: start.toISOString(),
			weekEnd: end.toISOString(),
			total: 0,
		};
	});

	for (const row of logRows) {
		const createdAt = new Date(row.created_at);
		const bucket = buckets.find((entry) => createdAt >= new Date(entry.weekStart) && createdAt < new Date(entry.weekEnd));

		if (bucket) {
			bucket.total += 1;
		}
	}

	return buckets;
}

function buildAuditFilterClauses(
	filters: AuditStatsFilters,
	values: Array<string | number | Date>,
	options: { includeAction?: boolean } = {},
): string {
	const clauses: string[] = [];

	if (filters.dateFrom) {
		values.push(filters.dateFrom);
		clauses.push(`al."createdAt" >= $${values.length}`);
	}

	if (filters.dateTo) {
		values.push(filters.dateTo);
		clauses.push(`al."createdAt" < $${values.length}`);
	}

	if (options.includeAction && filters.action) {
		values.push(filters.action);
		clauses.push(`al.action = $${values.length}`);
	}

	if (filters.role) {
		if (filters.role === "APPROVER") {
			values.push("PARISH_SECRETARY", "PARISH_PRIEST");
			clauses.push(`u.role IN ($${values.length - 1}, $${values.length})`);
		} else if (filters.role === "ADMIN") {
			values.push("ADMIN");
			clauses.push(`u.role = $${values.length}`);
		} else {
			values.push("REQUESTER");
			clauses.push(`u.role = $${values.length}`);
		}
	}

	if (filters.venueId) {
		values.push(filters.venueId);
		clauses.push(`vr."venueId" = $${values.length}`);
	}

	if (filters.requestId) {
		values.push(filters.requestId);
		clauses.push(`al."requestId" = $${values.length}`);
	}

	return clauses.length > 0 ? ` AND ${clauses.join(" AND ")}` : "";
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
	const client = await getPool().connect();
	try {
		const parsed = auditQuerySchema.safeParse(req.query);

		if (!parsed.success) {
			throw new AppError("Invalid audit query parameters", 400);
		}

		const filters = parsed.data;
		const page = filters.page ?? 1;
		const limit = filters.limit ?? 20;
		const offset = (page - 1) * limit;

		const selectColumns = `
			SELECT
				al.id,
				al.action,
				al.details,
				al."ipAddress",
				al."createdAt",
				u.id AS performed_by_id,
				u.name AS performed_by_name,
				u.email AS performed_by_email,
				u.role AS performed_by_role,
				vr.id AS request_id,
				vr."eventName" AS request_event_name,
				vr.purpose AS request_purpose,
				vr."startDateTime" AS request_start_date_time,
				vr."endDateTime" AS request_end_date_time,
				vr.attendees AS request_attendees,
				vr.status AS request_status,
				v.id AS venue_id,
				v.name AS venue_name,
				m.id AS ministry_id,
				m.name AS ministry_name,
				requester.id AS requester_id,
				requester.name AS requester_name,
				requester.email AS requester_email
			FROM "AuditLog" al
			JOIN "User" u ON al."performedById" = u.id
			LEFT JOIN "VenueRequest" vr ON al."requestId" = vr.id
			LEFT JOIN "Venue" v ON vr."venueId" = v.id
			LEFT JOIN "Ministry" m ON vr."ministryId" = m.id
			LEFT JOIN "User" requester ON vr."requesterId" = requester.id
		`;

		const countValues: Array<string | number | Date> = [];
		const whereClause = buildWhereClause(filters, countValues);
		const totalResult = await client.query(
			`SELECT COUNT(*)::int AS total FROM (${selectColumns} ${whereClause}) AS audit_rows`,
			countValues,
		);

		const rowsValues: Array<string | number | Date> = [...countValues, limit, offset];
		const rowsResult = await client.query(
			`${selectColumns} ${whereClause} ORDER BY al."createdAt" DESC, al.id DESC LIMIT $${rowsValues.length - 1} OFFSET $${rowsValues.length}`,
			rowsValues,
		);

		const total = totalResult.rows[0]?.total ?? 0;

		return res.json({
			success: true,
			data: {
				items: rowsResult.rows.map(mapAuditRow),
				total,
				page,
				limit,
				totalPages: Math.max(1, Math.ceil(total / limit)),
			},
		});
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function getAuditStats(req: Request, res: Response, next: NextFunction) {
	const client = await getPool().connect();
	try {
		const parsed = auditQuerySchema.safeParse(req.query);

		if (!parsed.success) {
			throw new AppError("Invalid audit query parameters", 400);
		}

		const filters = parsed.data;
		const monthStart = filters.dateFrom ? new Date(filters.dateFrom) : startOfMonth(new Date());
		const monthEnd = filters.dateTo ? new Date(filters.dateTo) : new Date(monthStart);
		if (!filters.dateTo) {
			monthEnd.setMonth(monthEnd.getMonth() + 1);
		}

		const statsValues: Array<string | number | Date> = [monthStart, monthEnd];
		const filterClause = buildAuditFilterClauses(filters, statsValues, { includeAction: true });
		const filteredBaseCte = `
			WITH filtered_rows AS (
				SELECT
					al.action,
					al.details,
					al."createdAt",
					al."requestId",
					u.role,
					vr."venueId",
					vr."ministryId"
				FROM "AuditLog" al
				JOIN "User" u ON al."performedById" = u.id
				LEFT JOIN "VenueRequest" vr ON al."requestId" = vr.id
				WHERE al."createdAt" >= $1 AND al."createdAt" < $2${filterClause}
			)`;

		const summaryResult = await client.query(
			`${filteredBaseCte},
			created_requests AS (
				SELECT "requestId", MIN("createdAt") AS created_at
				FROM filtered_rows
				WHERE action = 'REQUEST_CREATED' AND "requestId" IS NOT NULL
				GROUP BY "requestId"
			),
			decision_actions AS (
				SELECT "requestId", MIN("createdAt") AS decided_at
				FROM filtered_rows
				WHERE action IN ('REQUEST_APPROVED', 'REQUEST_REJECTED') AND "requestId" IS NOT NULL
				GROUP BY "requestId"
			)
			SELECT
				(SELECT COUNT(*)::int FROM filtered_rows WHERE action = 'REQUEST_CREATED') AS total_requests_this_month,
				COALESCE((
					SELECT AVG(EXTRACT(EPOCH FROM (d.decided_at - c.created_at)) / 3600.0)
					FROM created_requests c
					JOIN decision_actions d ON d."requestId" = c."requestId"
				), 0) AS average_approval_time_hours,
				(SELECT COUNT(*)::int FROM filtered_rows WHERE action = 'DSS_EVALUATION' AND COALESCE((details->>'hasConflict')::boolean, false)) AS total_conflicts_detected,
				COALESCE(ROUND(
					100.0 * (SELECT COUNT(*) FROM filtered_rows WHERE action = 'REQUEST_REJECTED')
					/ NULLIF((SELECT COUNT(*) FROM filtered_rows WHERE action IN ('REQUEST_APPROVED', 'REQUEST_REJECTED')), 0)
				, 2), 0) AS rejection_rate
			`,
			statsValues,
		);

		const ministryResult = await client.query(
			`${filteredBaseCte}
			SELECT
				COALESCE(m.id, 'unassigned') AS ministry_id,
				COALESCE(m.name, 'Unassigned') AS ministry_name,
				COUNT(*)::int AS total
			FROM filtered_rows fr
			LEFT JOIN "Ministry" m ON fr."ministryId" = m.id
			WHERE fr.action = 'REQUEST_CREATED'
			GROUP BY m.id, m.name
			ORDER BY total DESC, ministry_name ASC`,
			statsValues,
		);

		const weeklyLogsResult = await client.query(
			`${filteredBaseCte}
			SELECT fr."createdAt" AS created_at
			FROM filtered_rows fr
			WHERE fr.action = 'REQUEST_CREATED'
			ORDER BY fr."createdAt" ASC`,
			statsValues,
		);

		const summaryRow = summaryResult.rows[0] ?? {};
		const weeklyRequestVolume = buildWeeklyRequestVolume(weeklyLogsResult.rows as Array<{ created_at: string }>);

		return res.json({
			totalRequestsThisMonth: toNumber(summaryRow.total_requests_this_month),
			averageApprovalTimeHours: toNumber(summaryRow.average_approval_time_hours),
			totalConflictsDetected: toNumber(summaryRow.total_conflicts_detected),
			rejectionRate: toNumber(summaryRow.rejection_rate),
			requestsByMinistry: ministryResult.rows.map((row) => ({
				ministryId: row.ministry_id,
				ministryName: row.ministry_name,
				total: toNumber(row.total),
			})),
			weeklyRequestVolume,
		});
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export default {
	getAuditLogs,
	getAuditStats,
};
