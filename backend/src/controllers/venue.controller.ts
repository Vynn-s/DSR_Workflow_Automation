import type { NextFunction, Request, Response } from "express";
const { z } = require("zod") as typeof import("zod");
import {
	AdminInitiateAuthCommand,
	InitiateAuthCommand,
	CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

import config from "../config/env";
import { pool } from "../config/database";

let cognitoClient: CognitoIdentityProviderClient | null = null;

const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

const updateVenueSchema = z.object({
	name: z.string().trim().min(1).optional(),
	description: z.string().trim().nullable().optional(),
	capacity: z.coerce.number().int().positive().optional(),
	status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).optional(),
});

const createVenueSchema = z.object({
	name: z.string().trim().min(1),
	description: z.string().trim().nullable().optional(),
	capacity: z.coerce.number().int().positive(),
	status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).optional(),
});

const deleteVenueSchema = z.object({
	password: z.string().trim().min(1).max(256),
});

function canManageVenues(role?: string): boolean {
	return role === "ADMIN" || role === "PARISH_PRIEST";
}

function getCognitoClient(): CognitoIdentityProviderClient {
	if (cognitoClient) {
		return cognitoClient;
	}

	cognitoClient = new CognitoIdentityProviderClient({ region: config.awsRegion });
	return cognitoClient;
}

async function verifyCurrentAdminPassword(username: string, password: string) {
	try {
		await getCognitoClient().send(
			new AdminInitiateAuthCommand({
				UserPoolId: config.cognitoUserPoolId,
				ClientId: config.cognitoClientId,
				AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
				AuthParameters: {
					USERNAME: username,
					PASSWORD: password,
				},
			}),
		);
	} catch (error: any) {
		if (error?.name === "NotAuthorizedException" || error?.name === "UserNotFoundException") {
			throw new AppError("Invalid password", 401);
		}

		if (error?.name === "InvalidParameterException") {
			try {
				await getCognitoClient().send(
					new InitiateAuthCommand({
						ClientId: config.cognitoClientId,
						AuthFlow: "USER_PASSWORD_AUTH",
						AuthParameters: {
							USERNAME: username,
							PASSWORD: password,
						},
					}),
				);
				return;
			} catch (fallbackError: any) {
				if (fallbackError?.name === "NotAuthorizedException" || fallbackError?.name === "UserNotFoundException" || fallbackError?.name === "InvalidParameterException") {
					throw new AppError("Invalid password", 401);
				}

				throw fallbackError;
			}
		}

		throw error;
	}
}

export async function getVenues(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		// Lookup the user's ministry by email. req.user.id is the Cognito sub,
		// but the DB "User" row is keyed by email in this app.
		const ministryResult = await client.query(
			`SELECT "ministryId" FROM "User" WHERE email = $1`,
			[req.user.email],
		);

		if (req.user.role === "ADMIN" || req.user.role === "PARISH_PRIEST") {
			const venueRowsResult = await client.query(
				`SELECT
					v.id,
					v.name,
					v.description,
					v.capacity,
					v.status,
					v."createdAt",
					v."updatedAt",
					vm.id AS venue_ministry_id,
					vm."venueId" AS venue_ministry_venue_id,
					vm."ministryId" AS venue_ministry_ministry_id,
					m.id AS ministry_id,
					m.name AS ministry_name
				 FROM "Venue" v
				 LEFT JOIN "VenueMinistry" vm ON vm."venueId" = v.id
				 LEFT JOIN "Ministry" m ON m.id = vm."ministryId"
				 ORDER BY v.name ASC, vm.id ASC NULLS LAST`,
			);

			const venueMap = new Map<string, any>();
			for (const row of venueRowsResult.rows) {
				if (!venueMap.has(row.id)) {
					venueMap.set(row.id, {
						id: row.id,
						name: row.name,
						description: row.description,
						capacity: row.capacity,
						status: row.status,
						createdAt: row.createdAt,
						updatedAt: row.updatedAt,
						authorizedMinistries: [],
					});
				}

				if (row.venue_ministry_id) {
					venueMap.get(row.id).authorizedMinistries.push({
						id: row.venue_ministry_id,
						venueId: row.venue_ministry_venue_id,
						ministryId: row.venue_ministry_ministry_id,
						ministry: row.ministry_id ? { id: row.ministry_id, name: row.ministry_name } : null,
					});
				}
			}

			return res.json({ venues: Array.from(venueMap.values()) });
		}

		const ministryId = ministryResult.rows[0]?.ministryId as string | undefined;

		if (!ministryId) {
			return res.json({ venues: [] });
		}

		const venueRowsResult = await client.query(
			`SELECT
				v.id,
				v.name,
				v.description,
				v.capacity,
				v.status,
				v."createdAt",
				v."updatedAt",
				vm.id AS venue_ministry_id,
				vm."venueId" AS venue_ministry_venue_id,
				vm."ministryId" AS venue_ministry_ministry_id,
				m.id AS ministry_id,
				m.name AS ministry_name
			 FROM "Venue" v
			 LEFT JOIN "VenueMinistry" vm ON vm."venueId" = v.id
			 LEFT JOIN "Ministry" m ON m.id = vm."ministryId"
			 WHERE vm."ministryId" = $1 OR vm.id IS NULL
			 ORDER BY v.name ASC, vm.id ASC`,
			[ministryId],
		);

		const venueMap = new Map<string, any>();
		for (const row of venueRowsResult.rows) {
			if (!venueMap.has(row.id)) {
				venueMap.set(row.id, {
					id: row.id,
					name: row.name,
					description: row.description,
					capacity: row.capacity,
					status: row.status,
					createdAt: row.createdAt,
					updatedAt: row.updatedAt,
					authorizedMinistries: [],
				});
			}

			venueMap.get(row.id).authorizedMinistries.push({
				id: row.venue_ministry_id,
				venueId: row.venue_ministry_venue_id,
				ministryId: row.venue_ministry_ministry_id,
				ministry: row.ministry_id ? { id: row.ministry_id, name: row.ministry_name } : null,
			});
		}

		return res.json({ venues: Array.from(venueMap.values()) });
	} catch (error) {
		console.error("getVenues error:", error);
		return next(error);
	} finally {
		client.release();
	}
}

export async function getVenueById(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		const { id } = req.params;

		const venueResult = await client.query(
			`SELECT id, name, description, capacity, status, "createdAt", "updatedAt" FROM "Venue" WHERE id = $1`,
			[id],
		);
		
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

export async function updateVenue(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		if (!canManageVenues(req.user.role)) {
			throw new AppError("Insufficient permissions", 403);
		}

		const { id } = req.params;
		const venueId = Array.isArray(id) ? id[0] : id;
		const parsed = updateVenueSchema.safeParse(req.body);

		if (!parsed.success) {
			throw new AppError(
				`Invalid venue payload: ${parsed.error.issues.map((issue: any) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`,
				400,
			);
		}

		const existingVenue = await client.query(`SELECT id FROM "Venue" WHERE id = $1`, [venueId]);
		if (existingVenue.rows.length === 0) {
			throw new AppError("Venue not found", 404);
		}

		const updates: string[] = [];
		const values: Array<string | number | null> = [];

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

		await client.query(
			`UPDATE "Venue"
			 SET ${updates.join(", ")}, "updatedAt" = NOW()
			 WHERE id = $${values.length}`,
			values,
		);

		const venueResult = await client.query(
			`SELECT id, name, description, capacity, status, "createdAt", "updatedAt" FROM "Venue" WHERE id = $1`,
			[venueId],
		);

		const ministriesResult = await client.query(
			`SELECT vm.id, vm."venueId", vm."ministryId", m.id as ministry_id, m.name as ministry_name 
			 FROM "VenueMinistry" vm
			 LEFT JOIN "Ministry" m ON vm."ministryId" = m.id
			 WHERE vm."venueId" = $1`,
			[venueId],
		);

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
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function createVenue(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		if (!canManageVenues(req.user.role)) {
			throw new AppError("Insufficient permissions", 403);
		}

		const parsed = createVenueSchema.safeParse(req.body);
		if (!parsed.success) {
			throw new AppError(
				`Invalid venue payload: ${parsed.error.issues.map((issue: any) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`,
				400,
			);
		}

		const venueResult = await client.query(
			`INSERT INTO "Venue" (id, name, description, capacity, status, "createdAt", "updatedAt")
			 VALUES (gen_random_uuid()::text, $1, $2, $3, COALESCE($4::"VenueStatus", 'ACTIVE'::"VenueStatus"), NOW(), NOW())
			 RETURNING id, name, description, capacity, status, "createdAt", "updatedAt"`,
			[
				parsed.data.name,
				parsed.data.description ?? null,
				parsed.data.capacity,
				parsed.data.status ?? null,
			],
		);

		return res.status(201).json({
			venue: {
				...venueResult.rows[0],
				authorizedMinistries: [],
			},
		});
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export async function deleteVenue(req: Request, res: Response, next: NextFunction) {
	const client = await pool.connect();
	try {
		if (!req.user) {
			throw new AppError("Unauthorized", 401);
		}

		if (!canManageVenues(req.user.role)) {
			throw new AppError("Insufficient permissions", 403);
		}

		const parsedBody = deleteVenueSchema.safeParse(req.body);
		if (!parsedBody.success) {
			throw new AppError(
				`Invalid venue payload: ${parsedBody.error.issues.map((issue: any) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`,
				400,
			);
		}

		await verifyCurrentAdminPassword(req.user.cognitoUsername ?? req.user.email, parsedBody.data.password);

		const { id } = req.params;
		const venueId = Array.isArray(id) ? id[0] : id;

		const existingVenue = await client.query(
			`SELECT id, name FROM "Venue" WHERE id = $1`,
			[venueId],
		);

		if (existingVenue.rows.length === 0) {
			throw new AppError("Venue not found", 404);
		}

		const requestCountResult = await client.query(
			`SELECT COUNT(*)::int AS request_count FROM "VenueRequest" WHERE "venueId" = $1`,
			[venueId],
		);

		const requestCount = requestCountResult.rows[0]?.request_count ?? 0;
		if (requestCount > 0) {
			throw new AppError("This venue has booking history and cannot be deleted", 409);
		}

		await client.query("BEGIN");
		try {
			await client.query(`DELETE FROM "VenueMinistry" WHERE "venueId" = $1`, [venueId]);
			await client.query(`DELETE FROM "Venue" WHERE id = $1`, [venueId]);
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		}

		return res.json({ venueId });
	} catch (error) {
		return next(error);
	} finally {
		client.release();
	}
}

export default {
	getVenues,
	getVenueById,
	updateVenue,
	createVenue,
	deleteVenue,
};
