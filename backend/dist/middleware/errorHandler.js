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
    console.error(err.stack ?? err.message ?? err);
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