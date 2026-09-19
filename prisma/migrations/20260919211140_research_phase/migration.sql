-- CreateEnum
CREATE TYPE "ResearchPhase" AS ENUM ('PROPOSAL_ACCEPTED', 'DESIGN', 'DATA', 'TRAINING', 'ANALYSIS', 'WRITING', 'MANUSCRIPT_READY');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "phase" "ResearchPhase";

-- AlterTable
ALTER TABLE "ProjectUpdate" ADD COLUMN     "phase" "ResearchPhase";
