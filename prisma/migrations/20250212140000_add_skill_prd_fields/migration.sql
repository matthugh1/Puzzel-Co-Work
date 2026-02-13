-- CreateEnum
CREATE TYPE "CoworkSkillStatus" AS ENUM ('draft', 'published');

-- AlterTable: Add PRD fields to cowork_skills
ALTER TABLE "cowork_skills" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'General';
ALTER TABLE "cowork_skills" ADD COLUMN "tags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "cowork_skills" ADD COLUMN "parameters" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "cowork_skills" ADD COLUMN "exampleInput" TEXT;
ALTER TABLE "cowork_skills" ADD COLUMN "exampleOutput" TEXT;
ALTER TABLE "cowork_skills" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "cowork_skills" ADD COLUMN "status" "CoworkSkillStatus" NOT NULL DEFAULT 'draft';

-- CreateIndex
CREATE INDEX "cowork_skills_organizationId_category_idx" ON "cowork_skills"("organizationId", "category");
