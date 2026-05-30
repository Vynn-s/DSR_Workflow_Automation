require("dotenv").config();
const { Pool } = require("pg");
const crypto = require("crypto");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
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
    const ministrySeedData = [
      { name: "Knights of the Altar Servers", description: "Ministry for altar service coordination and liturgical support." },
      { name: "Parish Youth Apostolate", description: "Ministry for youth formation, activities, and outreach." },
      { name: "Confraternity of the Our Lady of Lourdes", description: "Devotional ministry for prayer gatherings and Marian activities." },
      { name: "Music Ministry", description: "Ministry for choir practice, music rehearsals, and liturgical music coordination." },
      { name: "Eucharistic Ministers of Holy Communion", description: "Ministry for Eucharistic service and sacred liturgical assignments." },
      { name: "Catholic Lay Apologists", description: "Ministry for catechetical talks, apologetics, and faith formation sessions." },
      { name: "Catechists", description: "Ministry for catechesis, formation classes, and teaching sessions." },
      { name: "Parish Ministry", description: "Legacy ministry used for existing venue access records." },
    ];

    for (const m of ministrySeedData) {
      const id = generateId();
      await client.query(
        `INSERT INTO "Ministry" (id, name, description, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, "updatedAt" = NOW()`,
        [id, m.name, m.description]
      );
    }

    const ministriesResult = await client.query(`SELECT id, name FROM "Ministry"`);
    const ministryMap = new Map(ministriesResult.rows.map((r) => [r.name, r.id]));

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

      for (const mid of ministryMap.values()) {
        await client.query(
          `INSERT INTO "VenueMinistry" (id, "venueId", "ministryId")
           VALUES ($1, $2, $3)
           ON CONFLICT ("venueId", "ministryId") DO NOTHING`,
          [generateId(), venueId, mid]
        );
      }
    }

    console.log("Seeding completed successfully.");
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
