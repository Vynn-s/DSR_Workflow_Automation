import type { NextFunction, Request, Response } from "express";

const prisma = require("../config/database").default as typeof import("../config/database").default;
const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

export async function getVenues(req: Request, res: Response, next: NextFunction) {
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const venues = await prisma.venue.findMany({
			include: {
				authorizedMinistries: {
					include: {
						ministry: true,
					},
				},
			},
			orderBy: {
				name: "asc",
			},
		});

		return res.json({ venues });
	} catch (error) {
		return next(error);
	}
}

export async function getVenueById(req: Request, res: Response, next: NextFunction) {
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const { id } = req.params;

		const venue = await prisma.venue.findUnique({
			where: { id },
			include: {
				authorizedMinistries: {
					include: {
						ministry: true,
					},
				},
			},
		});

		if (!venue) {
			throw new AppError("Venue not found", 404);
		}

		const now = new Date();

		const activeBookings = await prisma.venueRequest.findMany({
			where: {
				venueId: id,
				status: {
					in: ["PENDING", "SECRETARY_REVIEW", "PRIEST_REVIEW", "APPROVED"],
				},
				endDateTime: {
					gt: now,
				},
			},
			select: {
				id: true,
				eventName: true,
				startDateTime: true,
				endDateTime: true,
				status: true,
			},
			orderBy: {
				startDateTime: "asc",
			},
			take: 20,
		});

		return res.json({
			venue,
			availability: {
				activeBookingCount: activeBookings.length,
				activeBookings,
			},
		});
	} catch (error) {
		return next(error);
	}
}

export default {
	getVenues,
	getVenueById,
};
