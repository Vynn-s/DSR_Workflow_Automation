"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifications = getNotifications;
exports.markNotificationRead = markNotificationRead;
exports.markAllNotificationsRead = markAllNotificationsRead;
exports.deleteNotification = deleteNotification;
const zod_1 = require("zod");
const database_1 = require("../config/database");
const { AppError } = require("../middleware/errorHandler");
const listQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().positive().max(100).optional(),
    unreadOnly: zod_1.z.coerce.boolean().optional(),
});
const notificationIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
function mapNotification(row) {
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
async function getNotifications(req, res, next) {
    const client = await database_1.pool.connect();
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
            client.query(`SELECT
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
         LIMIT $2`, [req.user.id, limit]),
            client.query(`SELECT COUNT(*)::int AS count FROM "Notification" WHERE "userId" = $1 AND "readAt" IS NULL`, [req.user.id]),
        ]);
        return res.json({
            notifications: notificationsResult.rows.map(mapNotification),
            unreadCount: unreadResult.rows[0]?.count ?? 0,
        });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
async function markNotificationRead(req, res, next) {
    const client = await database_1.pool.connect();
    try {
        if (!req.user?.id) {
            throw new AppError("Unauthorized", 401);
        }
        const parsedParams = notificationIdParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            throw new AppError("Invalid notification id", 400);
        }
        const result = await client.query(`UPDATE "Notification"
       SET "readAt" = COALESCE("readAt", NOW())
       WHERE id = $1 AND "userId" = $2
       RETURNING id`, [parsedParams.data.id, req.user.id]);
        if (result.rows.length === 0) {
            throw new AppError("Notification not found", 404);
        }
        return res.json({ id: parsedParams.data.id, read: true });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
async function markAllNotificationsRead(req, res, next) {
    const client = await database_1.pool.connect();
    try {
        if (!req.user?.id) {
            throw new AppError("Unauthorized", 401);
        }
        const result = await client.query(`UPDATE "Notification"
       SET "readAt" = COALESCE("readAt", NOW())
       WHERE "userId" = $1 AND "readAt" IS NULL`, [req.user.id]);
        return res.json({ updated: result.rowCount ?? 0 });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
async function deleteNotification(req, res, next) {
    const client = await database_1.pool.connect();
    try {
        if (!req.user?.id) {
            throw new AppError("Unauthorized", 401);
        }
        const parsedParams = notificationIdParamsSchema.safeParse(req.params);
        if (!parsedParams.success) {
            throw new AppError("Invalid notification id", 400);
        }
        const result = await client.query(`DELETE FROM "Notification" WHERE id = $1 AND "userId" = $2 RETURNING id`, [parsedParams.data.id, req.user.id]);
        if (result.rows.length === 0) {
            throw new AppError("Notification not found", 404);
        }
        return res.json({ id: parsedParams.data.id });
    }
    catch (error) {
        return next(error);
    }
    finally {
        client.release();
    }
}
exports.default = {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
};
//# sourceMappingURL=notification.controller.js.map