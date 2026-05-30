const { Router } = require("express") as typeof import("express");

const { authenticate } = require("../middleware/auth") as typeof import("../middleware/auth");
const {
	evaluateRequest,
	checkConflicts,
	getBookingRecommendations,
	getPriests,
} = require("../controllers/dss.controller") as typeof import("../controllers/dss.controller");

const dssRoutes = Router();

dssRoutes.use(authenticate);

dssRoutes.post("/evaluate", evaluateRequest);
dssRoutes.get("/conflicts", checkConflicts);
dssRoutes.get("/recommendations", getBookingRecommendations);
dssRoutes.get("/priests", getPriests);

export { dssRoutes };
export default dssRoutes;
