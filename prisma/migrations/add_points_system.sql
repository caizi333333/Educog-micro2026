-- Add points fields to User table
ALTER TABLE "User" ADD COLUMN "totalPoints" INTEGER NOT NULL DEFAULT 0;

-- Create UserPointsTransaction table
CREATE TABLE "UserPointsTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPointsTransaction_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "UserPointsTransaction_userId_idx" ON "UserPointsTransaction"("userId");
CREATE INDEX "UserPointsTransaction_type_idx" ON "UserPointsTransaction"("type");
CREATE INDEX "UserPointsTransaction_createdAt_idx" ON "UserPointsTransaction"("createdAt");

-- Add foreign key
ALTER TABLE "UserPointsTransaction" ADD CONSTRAINT "UserPointsTransaction_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;