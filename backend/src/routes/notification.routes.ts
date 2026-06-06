const { Router } = require("express") as typeof import("express");

const { authenticate } = require("../middleware/auth") as typeof import("../middleware/auth");
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} = require("../controllers/notification.controller") as typeof import("../controllers/notification.controller");

const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get("/", getNotifications);
notificationRoutes.patch("/read-all", markAllNotificationsRead);
notificationRoutes.patch("/:id/read", markNotificationRead);
notificationRoutes.delete("/:id", deleteNotification);

export { notificationRoutes };
export default notificationRoutes;
