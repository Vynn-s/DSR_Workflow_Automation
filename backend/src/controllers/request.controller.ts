import type { NextFunction, Request, Response } from "express";

const { z } = require("zod") as typeof import("zod");

const prisma = require("../config/database").default as typeof import("../config/database").default;
const {
	evaluateRequest: runDssEvaluation,
} = require("../dss/rulesEngine") as typeof import("../dss/rulesEngine");
const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

const createRequestSchema = z.object({
	venueId: z.string().min(1),
	ministryId: z.string().min(1),
	eventName: z.string().min(1),
	purpose: z.string().min(1),
	startDateTime: z.coerce.date(),
	endDateTime: z.coerce.date(),
	attendees: z.coerce.number().int().positive(),
	specialRequirements: z.string().optional(),
});

const requestIdParamsSchema = z.object({
	id: z.string().min(1),
});

function toTimeString(date: Date): string {
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

export async function createRequest(req: Request, res: Response, next: NextFunction) {
	try {
		if (!req.user?.id) {
			throw new AppError("Unauthorized", 401);
		}

		const parsed = createRequestSchema.safeParse(req.body);

		if (!parsed.success) {
			throw new AppError("Invalid request payload", 400);
		}

		const input = parsed.data;

		if (input.endDateTime <= input.startDateTime) {
			throw new AppError("endDateTime must be later than startDateTime", 400);
		}

		const venue = await prisma.venue.findUnique({
			where: {
				id: input.venueId,
			},
			include: {
				authorizedMinistries: true,
			},
		});

		if (!venue) {
			throw new AppError("Venue not found", 404);
		}

		const conflicts = await prisma.venueRequest.findMany({
			where: {
				venueId: input.venueId,
				status: { not: "REJECTED" },
				startDateTime: { lt: input.endDateTime },
				endDateTime: { gt: input.startDateTime },
			},
			select: {
				id: true,
			},
		});

		const dssDecision = runDssEvaluation(
			{
				venueId: input.venueId,
				ministryId: input.ministryId,
				requestDate: input.startDateTime,
				startTime: toTimeString(input.startDateTime),
				endTime: toTimeString(input.endDateTime),
				attendees: input.attendees,
			},
			venue.capacity,
			venue.authorizedMinistries.map((entry) => entry.ministryId),
			conflicts.length > 0,
		);

		if (!dssDecision.canProceed) {
			throw new AppError(`DSS evaluation failed: ${dssDecision.recommendation}`, 400);
		}

		const secretary = await prisma.user.findFirst({
			where: {
				role: "PARISH_SECRETARY",
			},
			select: {
				id: true,
			},
		});

		if (!secretary) {
			throw new AppError("No PARISH_SECRETARY approver configured", 500);
		}

		const createdRequest = await prisma.venueRequest.create({
			data: {
				requesterId: req.user.id,
				venueId: input.venueId,
				ministryId: input.ministryId,
				eventName: input.eventName,
				purpose: input.purpose,
				startDateTime: input.startDateTime,
				endDateTime: input.endDateTime,
				attendees: input.attendees,
				specialRequirements: input.specialRequirements,
				status: "PENDING",
				currentApproverId: secretary.id,
			},
			include: {
				venue: true,
				ministry: true,
				approvalActions: true,
			},
		});

		await prisma.auditLog.create({
			data: {
				requestId: createdRequest.id,
				performedById: req.user.id,
				action: "REQUEST_CREATED",
				details: {
					requestId: createdRequest.id,
					dssDecision,
				},
				ipAddress: req.ip,
			},
		});

		return res.status(201).json(createdRequest);
	} catch (error) {
		return next(error);
	}
}

export async function getRequests(req: Request, res: Response, next: NextFunction) {
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const where: {
			requesterId?: string;
			status?: "PENDING" | "SECRETARY_REVIEW";
		} = {};

		if (req.user.role === "REQUESTER") {
			where.requesterId = req.user.id;
		} else if (req.user.role === "PARISH_SECRETARY") {
			where.status = "PENDING";
		} else if (req.user.role === "PARISH_PRIEST") {
			where.status = "SECRETARY_REVIEW";
		}

		const requests = await prisma.venueRequest.findMany({
			where,
			include: {
				venue: true,
				ministry: true,
				approvalActions: {
					include: {
						approver: true,
					},
					orderBy: {
						createdAt: "asc",
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		return res.json({ requests });
	} catch (error) {
		return next(error);
	}
}

export async function getRequestById(req: Request, res: Response, next: NextFunction) {
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const parsedParams = requestIdParamsSchema.safeParse(req.params);

		if (!parsedParams.success) {
			throw new AppError("Invalid request id", 400);
		}

		const requestRecord = await prisma.venueRequest.findUnique({
			where: {
				id: parsedParams.data.id,
			},
			include: {
				venue: true,
				ministry: true,
				requester: true,
				currentApprover: true,
				approvalActions: {
					include: {
						approver: true,
					},
					orderBy: {
						createdAt: "asc",
					},
				},
			},
		});

		if (!requestRecord) {
			throw new AppError("Request not found", 404);
		}

		if (req.user.role === "REQUESTER" && requestRecord.requesterId !== req.user.id) {
			throw new AppError("Insufficient permissions", 403);
		}

		return res.json(requestRecord);
	} catch (error) {
		return next(error);
	}
}

export async function cancelRequest(req: Request, res: Response, next: NextFunction) {
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const parsedParams = requestIdParamsSchema.safeParse(req.params);

		if (!parsedParams.success) {
			throw new AppError("Invalid request id", 400);
		}

		const existingRequest = await prisma.venueRequest.findUnique({
			where: {
				id: parsedParams.data.id,
			},
		});

		if (!existingRequest) {
			throw new AppError("Request not found", 404);
		}

		if (existingRequest.requesterId !== req.user.id) {
			throw new AppError("Insufficient permissions", 403);
		}

		if (existingRequest.status !== "PENDING") {
			throw new AppError("Only PENDING requests can be cancelled", 400);
		}

		const updatedRequest = await prisma.venueRequest.update({
			where: {
				id: existingRequest.id,
			},
			data: {
				status: "REJECTED",
				currentApproverId: null,
			},
		});

		await prisma.auditLog.create({
			data: {
				requestId: existingRequest.id,
				performedById: req.user.id,
				action: "REQUEST_CANCELLED",
				details: {
					previousStatus: existingRequest.status,
					nextStatus: "REJECTED",
				},
				ipAddress: req.ip,
			},
		});

		return res.json(updatedRequest);
	} catch (error) {
		return next(error);
	}
}

export default {
	createRequest,
	getRequests,
	getRequestById,
	cancelRequest,
};
