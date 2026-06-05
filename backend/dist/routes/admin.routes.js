"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const { Router } = require("express");
const { authenticate, requireRole, Role } = require("../middleware/auth");
const { listAdminUsers, createAdminUser, updateAdminUserRole, updateAdminUserMinistry, deleteAdminUser, getMinistries, } = require("../controllers/admin.controller");
const adminRoutes = Router();
exports.adminRoutes = adminRoutes;
adminRoutes.use(authenticate);
adminRoutes.use(requireRole([Role.ADMIN, Role.PARISH_PRIEST]));
adminRoutes.get("/users", listAdminUsers);
adminRoutes.post("/users", createAdminUser);
adminRoutes.get("/ministries", getMinistries);
adminRoutes.patch("/users/:id/role", updateAdminUserRole);
adminRoutes.patch("/users/:id/ministry", updateAdminUserMinistry);
adminRoutes.delete("/users/:id", deleteAdminUser);
exports.default = adminRoutes;
//# sourceMappingURL=admin.routes.js.map