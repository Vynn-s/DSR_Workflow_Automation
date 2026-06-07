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
const frontendUrl = process.env.FRONTEND_URL?.trim();
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'CathedralFlow API',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime())
    });
});
app.get('/ping', (_req, res) => {
    res.status(200).send('pong');
});
app.use(helmet());
app.use(cors({
    // Only allow the configured frontend origin in production; keep development flexible.
    origin: (origin, callback) => {
        if (process.env.NODE_ENV !== "production") {
            return callback(null, true);
        }
        if (!origin || origin === frontendUrl) {
            return callback(null, true);
        }
        return callback(new Error("CORS blocked"));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Ngrok-Skip-Browser-Warning'],
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date(),
    });
});
app.use("/api", routes);
app.use(errorHandler);
app.listen(port);
exports.default = app;
//# sourceMappingURL=index.js.map