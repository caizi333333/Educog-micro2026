-- Student feedback inbox. Anonymous is a display flag; userId stays for medals and rate limits.
CREATE TABLE "SiteFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pagePath" TEXT,
    "userAgent" TEXT,
    "classId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteFeedback_userId_createdAt_idx" ON "SiteFeedback"("userId", "createdAt");

CREATE INDEX "SiteFeedback_createdAt_idx" ON "SiteFeedback"("createdAt");

CREATE INDEX "SiteFeedback_classId_idx" ON "SiteFeedback"("classId");

ALTER TABLE "SiteFeedback" ADD CONSTRAINT "SiteFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
