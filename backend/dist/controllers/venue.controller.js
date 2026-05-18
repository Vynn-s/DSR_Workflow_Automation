"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVenues = getVenues;
exports.getVenueById = getVenueById;
exports.updateVenue = updateVenue;
const pg_1 = require("pg");
let pool = null;
function getPool() {
    if (pool)
        return pool;
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("Missing required environment variable: DATABASE_URL");
    }
    pool = new pg_1.Pool({
        connectionString,
        ssl: process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: true }
            : true,
    });
    return pool;
}
const { AppError } = require("../middleware/errorHandler");
const { z } = require("zod");
const updateVenueSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    capacity: z.coerce.number().int().positive().optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).optional(),
});
async function getVenues(req, res, next) {
    const client = await getPool().connect();
    try {
        console.log("getVenues: Starting request");
        if (!req.user) {
            console.log("getVenues: User not authenticated");
            throw new AppError("Unauthorized", 401);
        }
        const ministryResult = await client.query(`SELECT "ministryId" FROM "User" WHERE id = $1`, [req.user.id]);
        if (req.user.role === "ADMIN") {
            const allVenuesResult = await client.query(`SELECT id, name, description, capacity, status, "createdAt", "updatedAt" FROM "Venue" ORDER BY name ASC`);
            const venues = await Promise.all(allVenuesResult.rows.map(async (venue) => {
                const ministriesResult = await client.query(`SELECT vm.id, vm."venueId", vm."ministryId", m.id as ministry_id, m.name as ministry_name 
						 FROM "VenueMinistry" vm
						 LEFT JOIN "Ministry" m ON vm."ministryId" = m.id
						 WHERE vm."venueId" = $1`, [venue.id]);
                return {
                    ...venue,
                    authorizedMinistries: ministriesResult.rows.map(row => ({
                        id: row.id,
                        venueId: row.venueId,
                        ministryId: row.ministryId,
                        ministry: row.ministry_id ? { id: row.ministry_id, name: row.ministry_name } : null,
                    })),
                };
            }));
            console.log("getVenues: Found venues:", venues.length);
            return res.json({ venues });
        }
        const ministryId = ministryResult.rows[0]?.ministryId;
        if (!ministryId) {
            console.log("getVenues: No ministry found for user", req.user.id);
            return res.json({ venues: [] });
        }
        console.log("getVenues: Fetching venues for ministry", ministryId);
        const venueResult = await client.query(`SELECT DISTINCT v.*
			 FROM "Venue" v
			 INNER JOIN "VenueMinistry" vm ON vm."venueId" = v.id
			 WHERE vm."ministryId" = $1
			 ORDER BY v.name ASC`, [ministryId]);
        // For each venue, get authorized ministries
        const venues = await Promise.all(venueResult.rows.map(async (venue) => {
            const ministriesResult = await client.query(`SELECT vm.id, vm."venueId", vm."ministryId", m.id as ministry_id, m.name as ministry_name 
					 FROM "VenueMinistry" vm
					 LEFT JOIN "Ministry" m ON vm."ministryId" = m.id
					 WHERE vm."venueId" = $1`, [venue.id]);
            return {
                ...venue,
                authorizedMinistries: ministriesResult.rows.map(row => ({
                    id: row.id,
                    venueId: row.venueId,
                    ministryId: row.ministryId,
                    ministry: row.ministry_id ? { id: row.ministry_id, name: row.ministry_name } : null,
                })),
            };
        }));
        console.log("getVenues: Found venues:", venues.length);
        return res.json({ venues });
    }
    catch (error) {
        console.error("getVenues error:", error);
        return next(error);
    }
    finally {
        client.release();
    }
}
async function getVenueById(req, res, next) {
    const client = await getPool().connect();
    try {
        if (!req.user) {
            throw new AppError("Unauthorized", 401);
        }
        const { id } = req.params;
        const venueResult = await client.query(`SELECT id, name, description, capacity, status, "createdAt", "updatedAt" FROM "Venue" WHERE id = $1`, [id]);
        if (venueResult.rows.length === 0) {
            throw new AppError("Venue not found", 404);
        }
        const venue = venueResult.rows[0];
        const activeBookingsResult = await client.query(`SELECT id, "eventName", "startDateTime", "endDateTime", status 
			 FROM "VenueRequest" 
			 WHERE "venueId" = $1 
			 AND status IN ('PENDING', 'SECRETARY_REVIEW', 'PRIEST_REVIEW', 'APPROVED')
			 AND "endDateTime" > NOW()
			 ORDER BY "startDateTime" ASC
			 LIMIT 20`, [id]);
        return res.json({
            venue,
            availability: {
                activeBookingCount: activeBookingsResult.rows.length,
                activeBookings: activeBookingsResult.rows,
            },
        });
    }
    catch (error) {
        console.error("getVenueById error:", error);
        return next(error);
    }
    finally {
        client.release();
    }
}
async function updateVenue(req, res, next) {
    const client = await getPool().connect();
    try {
        if (!req.user) {
            throw new AppError("Unauthorized", 401);
        }
        if (req.user.role !== "ADMIN") {
            throw new AppError("Insufficient permissions", 403);
        }
        const { id } = req.params;
        const venueId = Array.isArray(id) ? id[0] : id;
        const parsed = updateVenueSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new AppError(`Invalid venue payload: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`, 400);
        }
        const existingVenue = await client.query(`SELECT id FROM "Venue" WHERE id = $1`, [venueId]);
        if (existingVenue.rows.length === 0) {
            throw new AppError("Venue not found", 404);
        }
        const updates = [];
        const values = [];
        if (parsed.data.name !== undefined) {
            updates.push(`name = $${values.length + 1}`);
            values.push(parsed.data.name);
        }
        if (parsed.data.description !== undefined) {
            updates.push(`description = $${values.length + 1}`);
            values.push(parsed.data.description);
        }
        if (parsed.data.capacity !== undefined) {
            updates.push(`capacity = $${values.length + 1}`);
            values.push(parsed.data.capacity);
        }
        if (parsed.data.status !== undefined) {
            updates.push(`status = $${values.length + 1}::"VenueStatus"`);
            values.push(parsed.data.status);
        }
        if (updates.length === 0) {
            throw new AppError("No venue fields provided to update", 400);
        }
        values.push(venueId);
        await client.query(`UPDATE "Venue"
			 SET ${updates.join(", ")}, "updatedAt" = NOW()
			 WHERE id = $${values.length}`, values);
        const venueResult = await client.query(`SELECT id, name, description, capacity, status, "createdAt", "updatedAt" FROM "Venue" WHERE id = $1`, [venueId]);
        const ministriesResult = await client.query(`SELECT vm.id, vm."venueId", vm."ministryId", m.id as ministry_id, m.name as ministry_name 
			 FROM "VenueMinistry" vm
			 LEFT JOIN "Ministry" m ON vm."ministryId" = m.id
			 WHERE vm."venueId" = $1`, [venueId]);
        return res.json({
            venue: {
                ...venueResult.rows[0],
                authorizedMinistries: ministriesResult.rows.map((row) => ({
                    id: row.id,
                    venueId: row.venueId,
                    ministryId: row.ministryId,
                    ministry: row.ministry_id ? { id: row.ministry_id, name: row.ministry_name } : null,
                })),
            },
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
    getVenues,
    getVenueById,
    updateVenue,
};
//# sourceMappingURL=venue.controller.js.map