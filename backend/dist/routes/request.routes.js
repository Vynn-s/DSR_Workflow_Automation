"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestRoutes = void 0;
const { Router } = require("express");
const { authenticate, requireRole, Role } = require("../middleware/auth");
const { createRequest, createDraftRequest, updateDraftRequest, submitDraftRequest, getRequests, getRequestById, cancelRequest, getAvailability, } = require("../controllers/request.controller");
const requestRoutes = Router();
exports.requestRoutes = requestRoutes;
requestRoutes.use(authenticate);
requestRoutes.post("/", requireRole([Role.REQUESTER]), createRequest);
requestRoutes.post("/draft", requireRole([Role.REQUESTER]), createDraftRequest);
requestRoutes.get("/availability", getAvailability);
requestRoutes.get("/", getRequests);
requestRoutes.patch("/:id/draft", requireRole([Role.REQUESTER]), updateDraftRequest);
requestRoutes.post("/:id/submit", requireRole([Role.REQUESTER]), submitDraftRequest);
requestRoutes.get("/:id", getRequestById);
requestRoutes.patch("/:id/cancel", requireRole([Role.REQUESTER]), cancelRequest);
exports.default = requestRoutes;
//# sourceMappingURL=request.routes.js.map