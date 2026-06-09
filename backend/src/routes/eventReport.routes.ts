const { Router } = require("express") as typeof import("express");
const { authenticate } = require("../middleware/auth") as typeof import("../middleware/auth");
const {
	createEventReport,
	updateEventReport,
	getEventReport,
	listEventReports,
} = require("../controllers/eventReport.controller") as typeof import("../controllers/eventReport.controller");

const eventReportRoutes = Router();

eventReportRoutes.use(authenticate);
eventReportRoutes.get("/", listEventReports);
eventReportRoutes.get("/:requestId", getEventReport);
eventReportRoutes.post("/:requestId", createEventReport);
eventReportRoutes.put("/:requestId", updateEventReport);

export { eventReportRoutes };
export default eventReportRoutes;
