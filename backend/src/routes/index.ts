const { Router } = require("express") as typeof import("express");

const { authRoutes } = require("./auth.routes") as typeof import("./auth.routes");
const { requestRoutes } = require("./request.routes") as typeof import("./request.routes");
const { approvalRoutes } = require("./approval.routes") as typeof import("./approval.routes");
const { venueRoutes } = require("./venue.routes") as typeof import("./venue.routes");
const { dssRoutes } = require("./dss.routes") as typeof import("./dss.routes");
const { auditRoutes } = require("./audit.routes") as typeof import("./audit.routes");

const routes = Router();

routes.use("/auth", authRoutes as import("express").Router);
routes.use("/requests", requestRoutes as import("express").Router);
routes.use("/approvals", approvalRoutes as import("express").Router);
routes.use("/venues", venueRoutes as import("express").Router);
routes.use("/dss", dssRoutes as import("express").Router);
routes.use("/audit", auditRoutes as import("express").Router);

export { routes };
export default routes;
