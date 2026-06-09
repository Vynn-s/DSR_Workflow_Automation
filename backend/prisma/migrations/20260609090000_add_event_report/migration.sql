CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "EventReport" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "requestId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "report" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventReport_requestId_key" ON "EventReport"("requestId");

ALTER TABLE "EventReport" ADD CONSTRAINT "EventReport_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VenueRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventReport" ADD CONSTRAINT "EventReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
