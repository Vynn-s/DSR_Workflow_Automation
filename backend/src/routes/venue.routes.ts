const { Router } = require("express") as typeof import("express");

const { authenticate } = require("../middleware/auth") as typeof import("../middleware/auth");
const {
	getVenues,
	getVenueById,
	updateVenue,
} = require("../controllers/venue.controller") as typeof import("../controllers/venue.controller");

const venueRoutes = Router();

venueRoutes.use(authenticate);

venueRoutes.get("/", getVenues);
venueRoutes.get("/:id", getVenueById);
venueRoutes.put("/:id", updateVenue);

export { venueRoutes };
export default venueRoutes;
