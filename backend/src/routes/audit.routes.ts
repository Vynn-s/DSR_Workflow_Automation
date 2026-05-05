const { Router } = require("express") as typeof import("express");

const { authenticate, requireRole, Role } = require("../middleware/auth") as typeof import("../middleware/auth");
const { getAuditLogs, getAuditStats } = require("../controllers/audit.controller") as typeof import("../controllers/audit.controller");

const auditRoutes = Router();

auditRoutes.use(authenticate);
auditRoutes.use(requireRole([Role.ADMIN, Role.PARISH_PRIEST]));

auditRoutes.get("/", getAuditLogs);
auditRoutes.get("/stats", getAuditStats);

export { auditRoutes };
export default auditRoutes;
