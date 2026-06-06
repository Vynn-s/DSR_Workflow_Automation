import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const sqlPath = path.join(__dirname, "seed.sql");
  const sql = await readFile(sqlPath, "utf8");
  await pool.query(sql);
  // The SQL is idempotent. A second pass lets dependent rows attach to freshly inserted requests
  // because PostgreSQL data-modifying CTEs use one statement snapshot.
  const result = await pool.query(sql);
  const summary = Array.isArray(result) ? result[result.length - 1]?.rows : result.rows;

  console.log("CathedralFlow seed completed.");
  if (summary?.length) {
    console.table(summary);
  }
}

main()
  .catch((error) => {
    console.error("CathedralFlow seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
