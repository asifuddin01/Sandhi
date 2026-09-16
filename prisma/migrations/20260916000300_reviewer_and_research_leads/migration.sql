-- Preserve the published Milestone 1 migration while applying the user's
-- updated role terminology and parallel project/research leadership model.
ALTER TYPE "SystemRole" RENAME VALUE 'EDITOR' TO 'REVIEWER';

ALTER TABLE "MemberArea"
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'Researcher',
ADD COLUMN "isLead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

DROP INDEX "MemberArea_areaId_idx";
CREATE INDEX "MemberArea_areaId_isLead_sortOrder_idx"
ON "MemberArea"("areaId", "isLead", "sortOrder");
