const { Router } = require("express") as typeof import("express");

const { authenticate, requireRole, Role } = require("../middleware/auth") as typeof import("../middleware/auth");
const {
	listAdminUsers,
	createAdminUser,
	updateAdminUserRole,
	deleteAdminUser,
	getMinistries,
} = require("../controllers/admin.controller") as typeof import("../controllers/admin.controller");

const adminRoutes = Router();

adminRoutes.use(authenticate);
adminRoutes.use(requireRole([Role.ADMIN, Role.PARISH_PRIEST]));

adminRoutes.get("/users", listAdminUsers);
adminRoutes.post("/users", createAdminUser);
adminRoutes.get("/ministries", getMinistries);
adminRoutes.patch("/users/:id/role", updateAdminUserRole);
adminRoutes.delete("/users/:id", deleteAdminUser);

export { adminRoutes };
export default adminRoutes;