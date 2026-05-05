const { Router } = require("express") as typeof import("express");

const { authenticate, requireRole, Role } = require("../middleware/auth") as typeof import("../middleware/auth");
const {
	createRequest,
	getRequests,
	getRequestById,
	cancelRequest,
} = require("../controllers/request.controller") as typeof import("../controllers/request.controller");

const requestRoutes = Router();

requestRoutes.use(authenticate);

requestRoutes.post("/", requireRole([Role.REQUESTER]), createRequest);
requestRoutes.get("/", getRequests);
requestRoutes.get("/:id", getRequestById);
requestRoutes.patch("/:id/cancel", requireRole([Role.REQUESTER]), cancelRequest);

export { requestRoutes };
export default requestRoutes;
