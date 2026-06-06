"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRoutes = void 0;
const { Router } = require("express");
const { authenticate } = require("../middleware/auth");
const { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, } = require("../controllers/notification.controller");
const notificationRoutes = Router();
exports.notificationRoutes = notificationRoutes;
notificationRoutes.use(authenticate);
notificationRoutes.get("/", getNotifications);
notificationRoutes.patch("/read-all", markAllNotificationsRead);
notificationRoutes.patch("/:id/read", markNotificationRead);
notificationRoutes.delete("/:id", deleteNotification);
exports.default = notificationRoutes;
//# sourceMappingURL=notification.routes.js.map