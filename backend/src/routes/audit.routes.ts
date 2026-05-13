const { Router } = require("express") as typeof import("express");

const { authenticate, requireRole, Role } = require("../middleware/auth") as typeof import("../middleware/auth");
const { getAuditLogs, getAuditStats } = require("../controllers/audit.controller") as typeof import("../controllers/audit.controller");

const auditRoutes = Router();

// In development, allow unauthenticated access to audit routes to make debugging easier.
// In production, enforce authentication and role checks.
if (process.env.NODE_ENV === "production") {
	auditRoutes.use(authenticate);
	auditRoutes.use(requireRole([Role.ADMIN, Role.PARISH_PRIEST]));
}

auditRoutes.get("/", getAuditLogs);
auditRoutes.get("/logs", getAuditLogs);
auditRoutes.get("/stats", getAuditStats);

export { auditRoutes };
export default auditRoutes;
