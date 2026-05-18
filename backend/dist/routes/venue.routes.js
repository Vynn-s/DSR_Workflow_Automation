"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.venueRoutes = void 0;
const { Router } = require("express");
const { authenticate } = require("../middleware/auth");
const { getVenues, getVenueById, updateVenue, } = require("../controllers/venue.controller");
const venueRoutes = Router();
exports.venueRoutes = venueRoutes;
venueRoutes.use(authenticate);
venueRoutes.get("/", getVenues);
venueRoutes.get("/:id", getVenueById);
venueRoutes.put("/:id", updateVenue);
exports.default = venueRoutes;
//# sourceMappingURL=venue.routes.js.map