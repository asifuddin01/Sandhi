-- Prisma does not know about the tsvector GIN indexes, so every generated
-- migration proposes dropping them. They stay.

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "profileCompletedAt" TIMESTAMP(3);

-- Anyone who already has the things the portal will now ask for has finished
-- their profile. Without this, the people already in the lab would be sent to
-- fill in a form they filled in long ago.
UPDATE "Member"
SET "profileCompletedAt" = "updatedAt"
WHERE "bio" IS NOT NULL
  AND length(btrim("bio")) > 0
  AND coalesce(array_length("interests", 1), 0) > 0;
