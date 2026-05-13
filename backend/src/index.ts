const dotenv = require("dotenv") as typeof import("dotenv");

dotenv.config();

const express = require("express") as typeof import("express");
const cors = require("cors") as typeof import("cors");
const helmet = require("helmet");

const { routes } = require("./routes") as typeof import("./routes");
const { errorHandler } = require("./middleware/errorHandler") as typeof import("./middleware/errorHandler");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(helmet());
app.use(
	cors({
		origin: process.env.FRONTEND_URL,
	}),
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
	res.json({
		status: "ok",
		timestamp: new Date(),
	});
});

app.use("/api", routes);
app.use(errorHandler);

app.listen(port, () => {
	console.log(`CathedralFlow backend running on port ${port}`);
});

export default app;
