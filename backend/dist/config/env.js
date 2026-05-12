"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
exports.config = {
    port: process.env.PORT || "3000",
    nodeEnv: process.env.NODE_ENV || "development",
    databaseUrl: requireEnv("DATABASE_URL"),
    cognitoUserPoolId: requireEnv("COGNITO_USER_POOL_ID"),
    cognitoClientId: requireEnv("COGNITO_CLIENT_ID"),
    awsRegion: process.env.AWS_REGION || "ap-southeast-1",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};
exports.default = exports.config;
//# sourceMappingURL=env.js.map