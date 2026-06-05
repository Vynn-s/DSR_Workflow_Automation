-- Run this in Supabase SQL Editor if local Prisma cannot reach the Supabase database.
-- It creates the Prisma schema and seeds ministries, venues, and venue-ministry access.

CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'PARISH_SECRETARY', 'PARISH_PRIEST', 'ADMIN');
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'SECRETARY_REVIEW', 'PRIEST_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');
CREATE TYPE "ApprovalActionType" AS ENUM ('APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'FORWARDED');
CREATE TYPE "VenueStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "ministryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ministry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ministry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "status" "VenueStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VenueRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "attendees" INTEGER NOT NULL,
    "specialRequirements" TEXT,
    "attachments" JSONB,
    "signatures" JSONB,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "currentApproverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VenueRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "action" "ApprovalActionType" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "performedById" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchedulingConflict" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "conflictingRequestId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchedulingConflict_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VenueMinistry" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VenueMinistry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Ministry_name_key" ON "Ministry"("name");
CREATE INDEX "VenueRequest_status_idx" ON "VenueRequest"("status");
CREATE INDEX "VenueRequest_requesterId_idx" ON "VenueRequest"("requesterId");
CREATE UNIQUE INDEX "VenueMinistry_venueId_ministryId_key" ON "VenueMinistry"("venueId", "ministryId");

ALTER TABLE "User" ADD CONSTRAINT "User_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VenueRequest" ADD CONSTRAINT "VenueRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueRequest" ADD CONSTRAINT "VenueRequest_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueRequest" ADD CONSTRAINT "VenueRequest_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueRequest" ADD CONSTRAINT "VenueRequest_currentApproverId_fkey" FOREIGN KEY ("currentApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VenueRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchedulingConflict" ADD CONSTRAINT "SchedulingConflict_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VenueRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueMinistry" ADD CONSTRAINT "VenueMinistry_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VenueMinistry" ADD CONSTRAINT "VenueMinistry_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH ministry_seed(name, description) AS (
  VALUES
    ('Knights of the Altar Servers', 'Ministry for altar service coordination and liturgical support.'),
    ('Parish Youth Apostolate', 'Ministry for youth formation, activities, and outreach.'),
    ('Confraternity of the Our Lady of Lourdes', 'Devotional ministry for prayer gatherings and Marian activities.'),
    ('Music Ministry', 'Ministry for choir practice, music rehearsals, and liturgical music coordination.'),
    ('Eucharistic Ministers of Holy Communion', 'Ministry for Eucharistic service and sacred liturgical assignments.'),
    ('Catholic Lay Apologists', 'Ministry for catechetical talks, apologetics, and faith formation sessions.'),
    ('Catechists', 'Ministry for catechesis, formation classes, and teaching sessions.'),
    ('Parish Ministry', 'Legacy ministry used for existing venue access records.')
)
INSERT INTO "Ministry" (id, name, description, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, name, description, NOW(), NOW()
FROM ministry_seed;

WITH venue_seed(name, description, capacity) AS (
  VALUES
    ('Mezzanine Hall A', 'Compact upper-level hall used for small meetings, rehearsals, and formation sessions.', 60),
    ('Mezzanine Hall B', 'Flexible mezzanine venue for workshops, prayer groups, and committee gatherings.', 60),
    ('Mezzanine Hall (Whole A & B)', 'Combined mezzanine space for larger seminars, formation events, and multi-group use.', 140),
    ('Socio Hall', 'Main social hall for parish celebrations, fellowship events, and community assemblies.', 220),
    ('Auditorium', 'Large event space for talks, presentations, parish-wide gatherings, and performances.', 350),
    ('Meeting Room 1', 'Small meeting room for staff discussions, planning sessions, and interviews.', 18),
    ('Meeting Room 2', 'Secondary meeting room for ministry coordination, counseling, and small groups.', 18),
    ('Parish Rectory', 'Administrative and pastoral support space used for clergy meetings and parish coordination.', 25),
    ('Blessed Sacrament Chapel', 'Quiet prayer chapel reserved for adoration, reflection, and intimate liturgical gatherings.', 80),
    ('Chapel of the Saints', 'Devotional chapel for prayer services, small masses, and contemplative gatherings.', 50)
)
INSERT INTO "Venue" (id, name, description, capacity, status, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, name, description, capacity, 'ACTIVE', NOW(), NOW()
FROM venue_seed;

INSERT INTO "VenueMinistry" (id, "venueId", "ministryId", "createdAt")
SELECT gen_random_uuid()::text, v.id, m.id, NOW()
FROM "Venue" v
CROSS JOIN "Ministry" m
ON CONFLICT ("venueId", "ministryId") DO NOTHING;
