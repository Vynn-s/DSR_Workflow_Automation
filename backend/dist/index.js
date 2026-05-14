"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { routes } = require("./routes");
const { errorHandler } = require("./middleware/errorHandler");
const app = express();
const port = Number(process.env.PORT) || 3000;
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Ngrok-Skip-Browser-Warning'],
}));
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
exports.default = app;
//# sourceMappingURL=index.js.map