import type { NextFunction, Request, Response } from "express";

const { z } = require("zod") as typeof import("zod");

const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

const auditQuerySchema = z.object({
	dateFrom: z.coerce.date().optional(),
	dateTo: z.coerce.date().optional(),
	action: z.string().min(1).optional(),
	role: z.enum(["REQUESTER", "PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"]).optional(),
	venueId: z.string().min(1).optional(),
	requestId: z.string().min(1).optional(),
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(100).optional(),
});

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

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
	try {
		// TEMPORARY: Return mock data while we debug Prisma issue
		return res.json({
			success: true,
			data: {
				items: [
					{
						id: "1",
						action: "REQUEST_CREATED",
						createdAt: new Date().toISOString(),
						performedBy: {
							id: "user1",
							name: "Test User",
							email: "test@example.com",
							role: "REQUESTER",
						},
						venueRequest: null,
					},
				],
				total: 1,
				page: 1,
				limit: 20,
				totalPages: 1,
			},
		});
	} catch (error) {
		return next(error);
	}
}

export async function getAuditStats(_req: Request, res: Response, next: NextFunction) {
	try {
		// TEMPORARY: Return mock stats while we debug Prisma issue
		return res.json({
			totalRequestsThisMonth: 42,
			averageApprovalTimeHours: 4.5,
			totalConflictsDetected: 2,
			rejectionRate: 15,
			requestsByMinistry: [
				{ ministryId: "m1", ministryName: "Music Ministry", total: 20 },
				{ ministryId: "m2", ministryName: "Youth Ministry", total: 15 },
				{ ministryId: "m3", ministryName: "Admin", total: 7 },
			],
			weeklyRequestVolume: [
				{ weekStart: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString(), weekEnd: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), total: 5 },
				{ weekStart: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), weekEnd: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(), total: 8 },
				{ weekStart: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(), weekEnd: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), total: 10 },
				{ weekStart: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), weekEnd: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), total: 7 },
				{ weekStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), weekEnd: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), total: 6 },
				{ weekStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), weekEnd: new Date().toISOString(), total: 6 },
			],
		});
	} catch (error) {
		return next(error);
	}
}

export default {
	getAuditLogs,
	getAuditStats,
};
