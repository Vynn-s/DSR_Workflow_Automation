require("dotenv").config();
const { Pool } = require("pg");
const crypto = require("crypto");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
});

function generateId() {
  return crypto.randomUUID();
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Starting seed...");

    // Create test ministry
    const ministryId = generateId();
    await client.query(
      `INSERT INTO "Ministry" (id, name, description, "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, NOW(), NOW()) 
       ON CONFLICT (name) DO NOTHING`,
      [ministryId, "Test Ministry", "Test ministry for development"]
    );
    console.log("✓ Created test ministry");

    // Get the ministry ID (in case it already existed)
    const ministryResult = await client.query(
      `SELECT id FROM "Ministry" WHERE name = $1`,
      ["Test Ministry"]
    );
    const actualMinistryId = ministryResult.rows[0].id;

    // Create test requester user
    const userId = "29fa25cc-0011-70ac-9fac-96999969d72f";
    await client.query(
      `INSERT INTO "User" (id, email, name, role, "ministryId", "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET "ministryId" = EXCLUDED."ministryId"`,
      [userId, "requester@test.com", "Test Requester", "REQUESTER", actualMinistryId]
    );
    console.log("✓ Created test requester user");

    // Create parish secretary
    await client.query(
      `INSERT INTO "User" (id, email, name, role, "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING`,
      [generateId(), "secretary@test.com", "Test Secretary", "PARISH_SECRETARY"]
    );
    console.log("✓ Created test secretary");

    // Create test venue
    const venueId = generateId();
    await client.query(
      `INSERT INTO "Venue" (id, name, description, capacity, "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [venueId, "Test Venue", "A test venue for development", 100]
    );
    console.log("✓ Created test venue");

    // Link venue to ministry
    await client.query(
      `INSERT INTO "VenueMinistry" (id, "venueId", "ministryId") 
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [generateId(), venueId, actualMinistryId]
    );
    console.log("✓ Linked venue to ministry");

    console.log("\n✅ Seeding completed successfully!");
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
