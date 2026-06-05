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
        name: "Mezzanine Hall A",
        description: "Compact upper-level hall used for small meetings, rehearsals, and formation sessions.",
        capacity: 60,
      },
      {
        name: "Mezzanine Hall B",
        description: "Flexible mezzanine venue for workshops, prayer groups, and committee gatherings.",
        capacity: 60,
      },
      {
        name: "Mezzanine Hall (Whole A & B)",
        description: "Combined mezzanine space for larger seminars, formation events, and multi-group use.",
        capacity: 140,
      },
      {
        name: "Socio Hall",
        description: "Main social hall for parish celebrations, fellowship events, and community assemblies.",
        capacity: 220,
      },
      {
        name: "Auditorium",
        description: "Large event space for talks, presentations, parish-wide gatherings, and performances.",
        capacity: 350,
      },
      {
        name: "Meeting Room 1",
        description: "Small meeting room for staff discussions, planning sessions, and interviews.",
        capacity: 18,
      },
      {
        name: "Meeting Room 2",
        description: "Secondary meeting room for ministry coordination, counseling, and small groups.",
        capacity: 18,
      },
      {
        name: "Parish Rectory",
        description: "Administrative and pastoral support space used for clergy meetings and parish coordination.",
        capacity: 25,
      },
      {
        name: "Blessed Sacrament Chapel",
        description: "Quiet prayer chapel reserved for adoration, reflection, and intimate liturgical gatherings.",
        capacity: 80,
      },
      {
        name: "Chapel of the Saints",
        description: "Devotional chapel for prayer services, small masses, and contemplative gatherings.",
        capacity: 50,
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
