const { Router } = require("express") as typeof import("express");

const { authenticate } = require("../middleware/auth") as typeof import("../middleware/auth");
const {
	getVenues,
	getVenueById,
} = require("../controllers/venue.controller") as typeof import("../controllers/venue.controller");

const venueRoutes = Router();

venueRoutes.use(authenticate);

venueRoutes.get("/", getVenues);
venueRoutes.get("/:id", getVenueById);

export { venueRoutes };
export default venueRoutes;
