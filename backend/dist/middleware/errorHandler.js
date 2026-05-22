"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.isOperational = true;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
function errorHandler(err, _req, res, _next) {
    const statusCode = err.statusCode ?? 500;
    const isProduction = process.env.NODE_ENV === "production";
    // Keep stack traces out of production logs so internal paths and code details are not exposed.
    if (isProduction) {
        console.error(`[${err.name ?? "Error"}] ${err.message ?? "Unknown error"} (status ${statusCode})`);
    }
    else {
        console.error(err.stack ?? err.message ?? err);
    }
    const message = statusCode >= 500
        ? "Internal Server Error"
        : err.message ?? "Request failed";
    res.status(statusCode).json({
        success: false,
        error: {
            message,
            statusCode,
        },
    });
}
exports.default = errorHandler;
//# sourceMappingURL=errorHandler.js.map