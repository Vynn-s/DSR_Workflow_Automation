"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRoutes = void 0;
const { Router } = require("express");
const { authenticate, requireRole, Role } = require("../middleware/auth");
const { getAuditLogs, getAuditStats } = require("../controllers/audit.controller");
const auditRoutes = Router();
exports.auditRoutes = auditRoutes;
auditRoutes.use(authenticate);
auditRoutes.use(requireRole([Role.ADMIN, Role.PARISH_PRIEST]));
auditRoutes.get("/", getAuditLogs);
auditRoutes.get("/stats", getAuditStats);
exports.default = auditRoutes;
//# sourceMappingURL=audit.routes.js.map