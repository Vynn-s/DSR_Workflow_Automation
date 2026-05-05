import type { NextFunction, Request, Response } from "express";

const { z } = require("zod") as typeof import("zod");

const prisma = require("../config/database").default as typeof import("../config/database").default;
const {
	evaluateRequest: runDssEvaluation,
} = require("../dss/rulesEngine") as typeof import("../dss/rulesEngine");
const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const evaluateRequestSchema = z.object({
	venueId: z.string().min(1),
	ministryId: z.string().min(1),
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
	try {
		const parsed = evaluateRequestSchema.safeParse(req.body);

		if (!parsed.success) {
			throw new AppError("Invalid request payload for DSS evaluation", 400);
		}

		if (!req.user?.id) {
			throw new AppError("Unauthorized", 401);
		}

		const { venueId, ministryId, requestDate, startTime, endTime, attendees } = parsed.data;

		const requestedStartDateTime = combineDateAndTime(requestDate, startTime);
		const requestedEndDateTime = combineDateAndTime(requestDate, endTime);

		if (requestedEndDateTime <= requestedStartDateTime) {
			throw new AppError("End time must be after start time", 400);
		}

		const venue = await prisma.venue.findUnique({
			where: { id: venueId },
			include: { authorizedMinistries: true },
		});

		if (!venue) {
			throw new AppError("Venue not found", 404);
		}

		const conflicts = await prisma.venueRequest.findMany({
			where: {
				venueId,
				status: { not: "REJECTED" },
				startDateTime: { lt: requestedEndDateTime },
				endDateTime: { gt: requestedStartDateTime },
			},
			select: { id: true },
		});

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
			venue.authorizedMinistries.map((entry) => entry.ministryId),
			conflicts.length > 0,
		);

		await prisma.auditLog.create({
			data: {
				performedById: req.user.id,
				action: "DSS_EVALUATION",
				details: {
					venueId,
					ministryId,
					hasConflict: conflicts.length > 0,
					decision,
				},
				ipAddress: req.ip,
			},
		});

		return res.json(decision);
	} catch (error) {
		if (error instanceof AppError) {
			return next(error);
		}

		return next(new AppError("Failed to evaluate DSS request", 500));
	}
}

export async function checkConflicts(
	req: Request,
	res: Response,
	next: NextFunction,
) {
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

		const conflicts = await prisma.venueRequest.findMany({
			where: {
				venueId,
				status: { not: "REJECTED" },
				startDateTime: { lt: requestedEndDateTime },
				endDateTime: { gt: requestedStartDateTime },
			},
			select: {
				id: true,
				eventName: true,
				purpose: true,
				startDateTime: true,
				endDateTime: true,
				status: true,
				attendees: true,
			},
			orderBy: { startDateTime: "asc" },
		});

		return res.json({
			conflicts,
		});
	} catch (error) {
		if (error instanceof AppError) {
			return next(error);
		}

		return next(new AppError("Failed to check scheduling conflicts", 500));
	}
}

export default {
	evaluateRequest,
	checkConflicts,
};
