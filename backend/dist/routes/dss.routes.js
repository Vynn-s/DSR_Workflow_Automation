"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dssRoutes = void 0;
const { Router } = require("express");
const { authenticate } = require("../middleware/auth");
const { evaluateRequest, checkConflicts, } = require("../controllers/dss.controller");
const dssRoutes = Router();
exports.dssRoutes = dssRoutes;
dssRoutes.use(authenticate);
dssRoutes.post("/evaluate", evaluateRequest);
dssRoutes.get("/conflicts", checkConflicts);
exports.default = dssRoutes;
//# sourceMappingURL=dss.routes.js.map