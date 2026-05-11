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
  // Create test ministry
  const testMinistry = await prisma.ministry.upsert({
    where: { name: "Test Ministry" },
    update: {},
    create: {
      name: "Test Ministry",
      description: "Test ministry for development",
    },
  });

  console.log("Created test ministry:", testMinistry);

  // Create test requester user (matches the Cognito user ID from your token)
  const testRequester = await prisma.user.upsert({
    where: { id: "29fa25cc-0011-70ac-9fac-96999969d72f" },
    update: {
      ministryId: testMinistry.id,
    },
    create: {
      id: "29fa25cc-0011-70ac-9fac-96999969d72f",
      email: "requester@test.com",
      name: "Test Requester",
      role: "REQUESTER",
      ministryId: testMinistry.id,
    },
  });

  console.log("Created/updated test requester:", testRequester);

  // Create a parish secretary for approvals
  const parishSecretary = await prisma.user.upsert({
    where: { email: "secretary@test.com" },
    update: {},
    create: {
      email: "secretary@test.com",
      name: "Test Secretary",
      role: "PARISH_SECRETARY",
    },
  });

  console.log("Created test secretary:", parishSecretary);

  // Create test venue
  let testVenue = await prisma.venue.findFirst({
    where: { name: "Test Venue" },
  });

  if (!testVenue) {
    testVenue = await prisma.venue.create({
      data: {
        name: "Test Venue",
        description: "A test venue for development",
        capacity: 100,
      },
    });
  }

  console.log("Created test venue:", testVenue);

  // Link venue to ministry
  await prisma.venueMinistry.upsert({
    where: {
      venueId_ministryId: {
        venueId: testVenue.id,
        ministryId: testMinistry.id,
      },
    },
    update: {},
    create: {
      venueId: testVenue.id,
      ministryId: testMinistry.id,
    },
  });

  console.log("Linked venue to ministry");

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
