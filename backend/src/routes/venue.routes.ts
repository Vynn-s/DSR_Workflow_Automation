const { Router } = require("express") as typeof import("express");

const { authenticate, requireRole, Role } = require("../middleware/auth") as typeof import("../middleware/auth");
const {
	getVenues,
	getVenueById,
	updateVenue,
	createVenue,
	deleteVenue,
} = require("../controllers/venue.controller") as typeof import("../controllers/venue.controller");

const venueRoutes = Router();

venueRoutes.use(authenticate);
venueRoutes.use(requireRole([Role.ADMIN, Role.PARISH_PRIEST]));

venueRoutes.get("/", getVenues);
venueRoutes.post("/", createVenue);
venueRoutes.get("/:id", getVenueById);
venueRoutes.put("/:id", updateVenue);
venueRoutes.delete("/:id", deleteVenue);

export { venueRoutes };
export default venueRoutes;
