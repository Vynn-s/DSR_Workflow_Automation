import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
declare global {
    var prisma: PrismaClient | undefined;
}
export declare const pool: Pool;
declare const prisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/client").DefaultArgs>;
export default prisma;
//# sourceMappingURL=database.d.ts.map