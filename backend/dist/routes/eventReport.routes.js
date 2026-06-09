"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventReportRoutes = void 0;
const { Router } = require("express");
const { authenticate } = require("../middleware/auth");
const { createEventReport, updateEventReport, getEventReport, listEventReports, } = require("../controllers/eventReport.controller");
const eventReportRoutes = Router();
exports.eventReportRoutes = eventReportRoutes;
eventReportRoutes.use(authenticate);
eventReportRoutes.get("/", listEventReports);
eventReportRoutes.get("/:requestId", getEventReport);
eventReportRoutes.post("/:requestId", createEventReport);
eventReportRoutes.put("/:requestId", updateEventReport);
exports.default = eventReportRoutes;
//# sourceMappingURL=eventReport.routes.js.map