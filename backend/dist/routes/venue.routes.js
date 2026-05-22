"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.venueRoutes = void 0;
const { Router } = require("express");
const { authenticate, requireRole, Role } = require("../middleware/auth");
const { getVenues, getVenueById, updateVenue, createVenue, deleteVenue, } = require("../controllers/venue.controller");
const venueRoutes = Router();
exports.venueRoutes = venueRoutes;
venueRoutes.use(authenticate);
venueRoutes.get("/", getVenues);
venueRoutes.get("/:id", getVenueById);
venueRoutes.use(requireRole([Role.ADMIN, Role.PARISH_PRIEST]));
venueRoutes.post("/", createVenue);
venueRoutes.put("/:id", updateVenue);
venueRoutes.delete("/:id", deleteVenue);
exports.default = venueRoutes;
//# sourceMappingURL=venue.routes.js.map