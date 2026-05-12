"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("Missing required environment variable: DATABASE_URL");
}
const pool = new pg_1.Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: true }
        : true, // Use ssl: true with NODE_TLS_REJECT_UNAUTHORIZED=0 for dev
});
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = global.prisma ?? new client_1.PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") {
    global.prisma = prisma;
}
exports.default = prisma;
//# sourceMappingURL=database.js.map