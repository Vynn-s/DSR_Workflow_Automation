const { Router } = require("express") as typeof import("express");

const { authenticate, requireRole, Role } = require("../middleware/auth") as typeof import("../middleware/auth");
const {
	listAdminUsers,
	createAdminUser,
	updateAdminUserRole,
} = require("../controllers/admin.controller") as typeof import("../controllers/admin.controller");

const adminRoutes = Router();

adminRoutes.use(authenticate);
adminRoutes.use(requireRole([Role.ADMIN]));

adminRoutes.get("/users", listAdminUsers);
adminRoutes.post("/users", createAdminUser);
adminRoutes.patch("/users/:id/role", updateAdminUserRole);

export { adminRoutes };
export default adminRoutes;