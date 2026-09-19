-- Widen the attachment table to two owners rather than dropping it: its rows
-- are files people uploaded, and a migration that loses them is not one we
-- would be willing to run against the live database.
ALTER TABLE "UpdateAttachment" RENAME TO "Attachment";
ALTER TABLE "Attachment" RENAME CONSTRAINT "UpdateAttachment_pkey" TO "Attachment_pkey";
ALTER TABLE "Attachment" RENAME CONSTRAINT "UpdateAttachment_updateId_fkey" TO "Attachment_updateId_fkey";
ALTER INDEX "UpdateAttachment_fileKey_key" RENAME TO "Attachment_fileKey_key";
ALTER INDEX "UpdateAttachment_updateId_sortOrder_idx" RENAME TO "Attachment_updateId_sortOrder_idx";

ALTER TABLE "Attachment" ALTER COLUMN "updateId" DROP NOT NULL;
ALTER TABLE "Attachment" ADD COLUMN "sectionId" TEXT;

-- CreateTable
CREATE TABLE "ProjectSection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "diagramId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_sectionId_sortOrder_idx" ON "Attachment"("sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectSection_projectId_sortOrder_idx" ON "ProjectSection"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectSection_projectId_isPublic_sortOrder_idx" ON "ProjectSection"("projectId", "isPublic", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectSection_diagramId_idx" ON "ProjectSection"("diagramId");

-- CreateIndex
CREATE INDEX "ProjectSection_authorId_idx" ON "ProjectSection"("authorId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ProjectSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSection" ADD CONSTRAINT "ProjectSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSection" ADD CONSTRAINT "ProjectSection_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSection" ADD CONSTRAINT "ProjectSection_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An attachment hangs off exactly one owner. Prisma cannot say this, and
-- without it a row could belong to a section and an update at once, or to
-- neither, and no read would ever find it.
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_one_owner"
  CHECK (num_nonnulls("sectionId", "updateId") = 1);
