"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const { Router } = require("express");
const { authenticate, requireRole, Role } = require("../middleware/auth");
const { listAdminUsers, createAdminUser, updateAdminUserRole, deleteAdminUser, } = require("../controllers/admin.controller");
const adminRoutes = Router();
exports.adminRoutes = adminRoutes;
adminRoutes.use(authenticate);
adminRoutes.use(requireRole([Role.ADMIN, Role.PARISH_PRIEST]));
adminRoutes.get("/users", listAdminUsers);
adminRoutes.post("/users", createAdminUser);
adminRoutes.patch("/users/:id/role", updateAdminUserRole);
adminRoutes.delete("/users/:id", deleteAdminUser);
exports.default = adminRoutes;
//# sourceMappingURL=admin.routes.js.map