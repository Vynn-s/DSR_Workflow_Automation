"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const { Router } = require("express");
const { authenticate, requireRole, Role } = require("../middleware/auth");
const { listAdminUsers, createAdminUser, updateAdminUserRole, } = require("../controllers/admin.controller");
const adminRoutes = Router();
exports.adminRoutes = adminRoutes;
adminRoutes.use(authenticate);
adminRoutes.use(requireRole([Role.ADMIN]));
adminRoutes.get("/users", listAdminUsers);
adminRoutes.post("/users", createAdminUser);
adminRoutes.patch("/users/:id/role", updateAdminUserRole);
exports.default = adminRoutes;
//# sourceMappingURL=admin.routes.js.map