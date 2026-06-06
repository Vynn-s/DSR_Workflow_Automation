import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../config/database";
const { AppError } = require("../middleware/errorHandler") as typeof import("../middleware/errorHandler");

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

const notificationIdParamsSchema = z.object({
  id: z.string().min(1),
});

function mapNotification(row: any) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    details: row.details,
    requestId: row.requestId,
    read: Boolean(row.readAt),
    readAt: row.readAt,
    createdAt: row.createdAt,
    request: row.request_reference
      ? {
        id: row.requestId,
        reference: row.request_reference,
        venueName: row.venue_name,
        eventName: row.event_name,
        status: row.request_status,
      }
      : null,
  };
}

export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid notification query", 400);
    }

    const limit = parsed.data.limit ?? 50;
    const unreadFilter = parsed.data.unreadOnly ? `AND n."readAt" IS NULL` : "";

    const [notificationsResult, unreadResult] = await Promise.all([
      client.query(
        `SELECT
          n.id,
          n.type,
          n.title,
          n.message,
          n.details,
          n."requestId",
          n."readAt",
          n."createdAt",
          vr.id AS request_reference,
          vr."eventName" AS event_name,
          vr.status AS request_status,
          v.name AS venue_name
         FROM "Notification" n
         LEFT JOIN "VenueRequest" vr ON vr.id = n."requestId"
         LEFT JOIN "Venue" v ON v.id = vr."venueId"
         WHERE n."userId" = $1 ${unreadFilter}
         ORDER BY n."createdAt" DESC
         LIMIT $2`,
        [req.user.id, limit],
      ),
      client.query(
        `SELECT COUNT(*)::int AS count FROM "Notification" WHERE "userId" = $1 AND "readAt" IS NULL`,
        [req.user.id],
      ),
    ]);

    return res.json({
      notifications: notificationsResult.rows.map(mapNotification),
      unreadCount: unreadResult.rows[0]?.count ?? 0,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "42P01") {
      return res.json({ notifications: [], unreadCount: 0 });
    }

    return next(error);
  } finally {
    client.release();
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction) {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const parsedParams = notificationIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new AppError("Invalid notification id", 400);
    }

    const result = await client.query(
      `UPDATE "Notification"
       SET "readAt" = COALESCE("readAt", NOW())
       WHERE id = $1 AND "userId" = $2
       RETURNING id`,
      [parsedParams.data.id, req.user.id],
    );

    if (result.rows.length === 0) {
      throw new AppError("Notification not found", 404);
    }

    return res.json({ id: parsedParams.data.id, read: true });
  } catch (error) {
    return next(error);
  } finally {
    client.release();
  }
}

export async function markAllNotificationsRead(req: Request, res: Response, next: NextFunction) {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const result = await client.query(
      `UPDATE "Notification"
       SET "readAt" = COALESCE("readAt", NOW())
       WHERE "userId" = $1 AND "readAt" IS NULL`,
      [req.user.id],
    );

    return res.json({ updated: result.rowCount ?? 0 });
  } catch (error) {
    return next(error);
  } finally {
    client.release();
  }
}

export async function deleteNotification(req: Request, res: Response, next: NextFunction) {
  const client = await pool.connect();
  try {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const parsedParams = notificationIdParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      throw new AppError("Invalid notification id", 400);
    }

    const result = await client.query(
      `DELETE FROM "Notification" WHERE id = $1 AND "userId" = $2 RETURNING id`,
      [parsedParams.data.id, req.user.id],
    );

    if (result.rows.length === 0) {
      throw new AppError("Notification not found", 404);
    }

    return res.json({ id: parsedParams.data.id });
  } catch (error) {
    return next(error);
  } finally {
    client.release();
  }
}

export default {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
};
