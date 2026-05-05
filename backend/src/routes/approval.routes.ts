const { Router } = require("express") as typeof import("express");

const { authenticate, requireRole, Role } = require("../middleware/auth") as typeof import("../middleware/auth");
const {
	getApprovalQueue,
	approveRequest,
	rejectRequest,
	requestRevision,
} = require("../controllers/approval.controller") as typeof import("../controllers/approval.controller");

const approvalRoutes = Router();

approvalRoutes.use(authenticate);
approvalRoutes.use(requireRole([Role.PARISH_SECRETARY, Role.PARISH_PRIEST]));

approvalRoutes.get("/queue", getApprovalQueue);
approvalRoutes.post("/:requestId/approve", approveRequest);
approvalRoutes.post("/:requestId/reject", rejectRequest);
approvalRoutes.post("/:requestId/revise", requestRevision);

export { approvalRoutes };
export default approvalRoutes;
