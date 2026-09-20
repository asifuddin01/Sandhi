-- Prisma does not know about the tsvector GIN indexes, so every generated
-- migration proposes dropping them. They stay.

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "decisionSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "decisionSentAt" TIMESTAMP(3);
