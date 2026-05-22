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

venueRoutes.get("/", getVenues);
venueRoutes.get("/:id", getVenueById);

venueRoutes.use(requireRole([Role.ADMIN, Role.PARISH_PRIEST]));

venueRoutes.post("/", createVenue);
venueRoutes.put("/:id", updateVenue);
venueRoutes.delete("/:id", deleteVenue);

export { venueRoutes };
export default venueRoutes;
