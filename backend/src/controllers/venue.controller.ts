import type { NextFunction, Request, Response } from "express";
import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
	if (pool) return pool;

	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error("Missing required environment variable: DATABASE_URL");
	}

	pool = new Pool({
		connectionString,
		ssl: process.env.NODE_ENV === "production" 
			? { rejectUnauthorized: true }
			: true,
	});
	return pool;
}

const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

export async function getVenues(req: Request, res: Response, next: NextFunction) {
	const client = await getPool().connect();
	try {
		console.log("getVenues: Starting request");
		
		if (!req.user) {
			console.log("getVenues: User not authenticated");
			throw new AppError("Unauthorized", 401);
		}

		const ministryResult = await client.query(
			`SELECT "ministryId" FROM "User" WHERE id = $1`,
			[req.user.id],
		);

		if (req.user.role === "ADMIN") {
			const allVenuesResult = await client.query(
				`SELECT * FROM "Venue" ORDER BY name ASC`,
			);

			const venues = await Promise.all(
				allVenuesResult.rows.map(async (venue) => {
					const ministriesResult = await client.query(
						`SELECT vm.id, vm."venueId", vm."ministryId", m.id as ministry_id, m.name as ministry_name 
						 FROM "VenueMinistry" vm
						 LEFT JOIN "Ministry" m ON vm."ministryId" = m.id
						 WHERE vm."venueId" = $1`,
						[venue.id]
					);

					return {
						...venue,
						authorizedMinistries: ministriesResult.rows.map(row => ({
							id: row.id,
							venueId: row.venueId,
							ministryId: row.ministryId,
							ministry: row.ministry_id ? { id: row.ministry_id, name: row.ministry_name } : null,
						})),
					};
				})
			);

			console.log("getVenues: Found venues:", venues.length);
			return res.json({ venues });
		}

		const ministryId = ministryResult.rows[0]?.ministryId as string | undefined;

		if (!ministryId) {
			console.log("getVenues: No ministry found for user", req.user.id);
			return res.json({ venues: [] });
		}

		console.log("getVenues: Fetching venues for ministry", ministryId);
		const venueResult = await client.query(
			`SELECT DISTINCT v.*
			 FROM "Venue" v
			 INNER JOIN "VenueMinistry" vm ON vm."venueId" = v.id
			 WHERE vm."ministryId" = $1
			 ORDER BY v.name ASC`,
			[ministryId],
		);
		
		// For each venue, get authorized ministries
		const venues = await Promise.all(
			venueResult.rows.map(async (venue) => {
				const ministriesResult = await client.query(
					`SELECT vm.id, vm."venueId", vm."ministryId", m.id as ministry_id, m.name as ministry_name 
					 FROM "VenueMinistry" vm
					 LEFT JOIN "Ministry" m ON vm."ministryId" = m.id
					 WHERE vm."venueId" = $1`,
					[venue.id]
				);
				
				return {
					...venue,
					authorizedMinistries: ministriesResult.rows.map(row => ({
						id: row.id,
						venueId: row.venueId,
						ministryId: row.ministryId,
						ministry: row.ministry_id ? { id: row.ministry_id, name: row.ministry_name } : null,
					})),
				};
			})
		);
		
		console.log("getVenues: Found venues:", venues.length);
		return res.json({ venues });
	} catch (error) {
		console.error("getVenues error:", error);
		return next(error);
	} finally {
		client.release();
	}
}

export async function getVenueById(req: Request, res: Response, next: NextFunction) {
	const client = await getPool().connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const { id } = req.params;

		const venueResult = await client.query(`SELECT * FROM "Venue" WHERE id = $1`, [id]);
		
		if (venueResult.rows.length === 0) {
			throw new AppError("Venue not found", 404);
		}

		const venue = venueResult.rows[0];

		const activeBookingsResult = await client.query(
			`SELECT id, "eventName", "startDateTime", "endDateTime", status 
			 FROM "VenueRequest" 
			 WHERE "venueId" = $1 
			 AND status IN ('PENDING', 'SECRETARY_REVIEW', 'PRIEST_REVIEW', 'APPROVED')
			 AND "endDateTime" > NOW()
			 ORDER BY "startDateTime" ASC
			 LIMIT 20`,
			[id]
		);

		return res.json({
			venue,
			availability: {
				activeBookingCount: activeBookingsResult.rows.length,
				activeBookings: activeBookingsResult.rows,
			},
		});
	} catch (error) {
		console.error("getVenueById error:", error);
		return next(error);
	} finally {
		client.release();
	}
}

export default {
	getVenues,
	getVenueById,
};
