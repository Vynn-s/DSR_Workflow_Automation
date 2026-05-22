import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" 
    ? { rejectUnauthorized: true }
    : true, // Development: NODE_TLS_REJECT_UNAUTHORIZED=0 handles it
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const testMinistry = await prisma.ministry.upsert({
    where: { name: "Parish Ministry" },
    update: {
      description: "Primary parish ministry used for venue access",
    },
    create: {
      name: "Parish Ministry",
      description: "Primary parish ministry used for venue access",
    },
  });

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
    const createdVenue = await prisma.venue.upsert({
      where: { name: venue.name },
      update: {
        description: venue.description,
        capacity: venue.capacity,
      },
      create: venue,
    });

    await prisma.venueMinistry.upsert({
      where: {
        venueId_ministryId: {
          venueId: createdVenue.id,
          ministryId: testMinistry.id,
        },
      },
      update: {},
      create: {
        venueId: createdVenue.id,
        ministryId: testMinistry.id,
      },
    });
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
