"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRoutes = void 0;
const { Router } = require("express");
const { authenticate, requireRole, Role } = require("../middleware/auth");
const { getAuditLogs, getAuditStats } = require("../controllers/audit.controller");
const auditRoutes = Router();
exports.auditRoutes = auditRoutes;
// In development, allow unauthenticated access to audit routes to make debugging easier.
// In production, enforce authentication and role checks.
if (process.env.NODE_ENV === "production") {
    auditRoutes.use(authenticate);
    auditRoutes.use(requireRole([Role.ADMIN, Role.PARISH_PRIEST]));
}
auditRoutes.get("/", getAuditLogs);
auditRoutes.get("/logs", getAuditLogs);
auditRoutes.get("/stats", getAuditStats);
exports.default = auditRoutes;
//# sourceMappingURL=audit.routes.js.map