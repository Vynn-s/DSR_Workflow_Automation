const { Router } = require("express") as typeof import("express");

const { authenticate } = require("../middleware/auth") as typeof import("../middleware/auth");
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
venueRoutes.post("/", createVenue);
venueRoutes.get("/:id", getVenueById);
venueRoutes.put("/:id", updateVenue);
venueRoutes.delete("/:id", deleteVenue);

export { venueRoutes };
export default venueRoutes;
