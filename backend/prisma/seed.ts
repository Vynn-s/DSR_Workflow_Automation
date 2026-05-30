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
  const ministrySeedData = [
    {
      name: "Knights of the Altar Servers",
      description: "Ministry for altar service coordination and liturgical support.",
    },
    {
      name: "Parish Youth Apostolate",
      description: "Ministry for youth formation, activities, and outreach.",
    },
    {
      name: "Confraternity of the Our Lady of Lourdes",
      description: "Devotional ministry for prayer gatherings and Marian activities.",
    },
    {
      name: "Music Ministry",
      description: "Ministry for choir practice, music rehearsals, and liturgical music coordination.",
    },
    {
      name: "Eucharistic Ministers of Holy Communion",
      description: "Ministry for Eucharistic service and sacred liturgical assignments.",
    },
    {
      name: "Catholic Lay Apologists",
      description: "Ministry for catechetical talks, apologetics, and faith formation sessions.",
    },
    {
      name: "Catechists",
      description: "Ministry for catechesis, formation classes, and teaching sessions.",
    },
    {
      name: "Parish Ministry",
      description: "Legacy ministry used for existing venue access records.",
    },
  ];

  const ministries = [];
  for (const ministry of ministrySeedData) {
    const createdMinistry = await prisma.ministry.upsert({
      where: { name: ministry.name },
      update: { description: ministry.description },
      create: ministry,
    });

    ministries.push(createdMinistry);
  }

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

  const liveVenueNames = new Set(venues.map((venue) => venue.name));

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
    for (const ministry of ministries) {
      await prisma.venueMinistry.upsert({
        where: {
          venueId_ministryId: {
            venueId: createdVenue.id,
            ministryId: ministry.id,
          },
        },
        update: {},
        create: {
          venueId: createdVenue.id,
          ministryId: ministry.id,
        },
      });
    }

  await prisma.venue.updateMany({
    where: {
      name: {
        notIn: Array.from(liveVenueNames),
      },
    },
    data: {
      status: "INACTIVE",
    },
  });

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
