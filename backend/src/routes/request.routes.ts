const { Router } = require("express") as typeof import("express");

const { authenticate, requireRole, Role } = require("../middleware/auth") as typeof import("../middleware/auth");
const {
	createRequest,
	createDraftRequest,
	updateDraftRequest,
	submitDraftRequest,
	getRequests,
	getRequestById,
	cancelRequest,
	getAvailability,
	} = require("../controllers/request.controller") as typeof import("../controllers/request.controller");

const requestRoutes = Router();

requestRoutes.use(authenticate);

requestRoutes.post("/", requireRole([Role.REQUESTER]), createRequest);
requestRoutes.post("/draft", requireRole([Role.REQUESTER]), createDraftRequest);
requestRoutes.get("/availability", getAvailability);
requestRoutes.get("/", getRequests);
requestRoutes.patch("/:id/draft", requireRole([Role.REQUESTER]), updateDraftRequest);
requestRoutes.post("/:id/submit", requireRole([Role.REQUESTER]), submitDraftRequest);
requestRoutes.get("/:id", getRequestById);
requestRoutes.patch("/:id/cancel", requireRole([Role.REQUESTER]), cancelRequest);

export { requestRoutes };
export default requestRoutes;
