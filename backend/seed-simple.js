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

async function getOrCreateVenue(client, name, description, capacity) {
  const existingVenue = await client.query(
    `SELECT id FROM "Venue" WHERE name = $1 ORDER BY "createdAt" ASC LIMIT 1`,
    [name]
  );

  if (existingVenue.rows.length > 0) {
    return existingVenue.rows[0].id;
  }

  const venueId = generateId();
  await client.query(
    `INSERT INTO "Venue" (id, name, description, capacity, "createdAt", "updatedAt") 
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [venueId, name, description, capacity]
  );

  return venueId;
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

    const venues = [
      {
        name: "Main Chapel",
        description: "Primary worship space for Masses, weddings, and liturgical celebrations.",
        capacity: 500,
      },
      {
        name: "Parish Hall",
        description: "Flexible hall for parish meetings, community meals, and ministry events.",
        capacity: 200,
      },
      {
        name: "Multipurpose Room",
        description: "Smaller room for classes, rehearsals, and group meetings.",
        capacity: 80,
      },
      {
        name: "Chapel Garden",
        description: "Outdoor venue for receptions, gatherings, and pastoral celebrations.",
        capacity: 150,
      },
      {
        name: "Conference Room",
        description: "Meeting space for staff sessions, planning, and administrative discussions.",
        capacity: 30,
      },
      {
        name: "Youth Center",
        description: "Dedicated venue for youth formation, activities, and social events.",
        capacity: 100,
      },
    ];

    for (const venue of venues) {
      const venueId = await getOrCreateVenue(client, venue.name, venue.description, venue.capacity);

      await client.query(
        `INSERT INTO "VenueMinistry" (id, "venueId", "ministryId") 
         VALUES ($1, $2, $3)
         ON CONFLICT ("venueId", "ministryId") DO NOTHING`,
        [generateId(), venueId, actualMinistryId]
      );

      console.log(`✓ Ready venue: ${venue.name}`);
    }

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
