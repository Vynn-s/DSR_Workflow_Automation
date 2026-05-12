"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalRoutes = void 0;
const { Router } = require("express");
const { authenticate, requireRole, Role } = require("../middleware/auth");
const { getApprovalQueue, approveRequest, rejectRequest, requestRevision, getArchive, } = require("../controllers/approval.controller");
const approvalRoutes = Router();
exports.approvalRoutes = approvalRoutes;
approvalRoutes.use(authenticate);
approvalRoutes.use(requireRole([Role.PARISH_SECRETARY, Role.PARISH_PRIEST]));
approvalRoutes.get("/queue", getApprovalQueue);
approvalRoutes.get("/archive", getArchive);
approvalRoutes.post("/:requestId/approve", approveRequest);
approvalRoutes.post("/:requestId/reject", rejectRequest);
approvalRoutes.post("/:requestId/revise", requestRevision);
exports.default = approvalRoutes;
//# sourceMappingURL=approval.routes.js.map