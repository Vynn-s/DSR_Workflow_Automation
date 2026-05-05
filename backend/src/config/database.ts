import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");

declare global {
	// eslint-disable-next-line no-var
	var prisma: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("Missing required environment variable: DATABASE_URL");
}

const adapter = new PrismaPg({ connectionString });

const prisma = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
	global.prisma = prisma;
}

export default prisma;
