-- CreateTable: CoworkSkill (skills stored in DB, tenant-scoped)
CREATE TABLE "cowork_skills" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "triggers" JSONB NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cowork_skills_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cowork_skills_organizationId_idx" ON "cowork_skills"("organizationId");
CREATE INDEX "cowork_skills_sessionId_idx" ON "cowork_skills"("sessionId");
CREATE INDEX "cowork_skills_organizationId_sessionId_idx" ON "cowork_skills"("organizationId", "sessionId");

ALTER TABLE "cowork_skills" ADD CONSTRAINT "cowork_skills_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cowork_skills" ADD CONSTRAINT "cowork_skills_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cowork_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cowork_skills" ADD CONSTRAINT "cowork_skills_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
