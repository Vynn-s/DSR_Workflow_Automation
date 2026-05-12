"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestRoutes = void 0;
const { Router } = require("express");
const { authenticate, requireRole, Role } = require("../middleware/auth");
const { createRequest, getRequests, getRequestById, cancelRequest, getAvailability, } = require("../controllers/request.controller");
const requestRoutes = Router();
exports.requestRoutes = requestRoutes;
requestRoutes.use(authenticate);
requestRoutes.post("/", requireRole([Role.REQUESTER]), createRequest);
requestRoutes.get("/availability", getAvailability);
requestRoutes.get("/", getRequests);
requestRoutes.get("/:id", getRequestById);
requestRoutes.patch("/:id/cancel", requireRole([Role.REQUESTER]), cancelRequest);
exports.default = requestRoutes;
//# sourceMappingURL=request.routes.js.map