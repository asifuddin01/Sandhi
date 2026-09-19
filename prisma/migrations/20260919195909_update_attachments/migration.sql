-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('FIGURE', 'DOCUMENT', 'DATA');

-- CreateTable
CREATE TABLE "UpdateAttachment" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpdateAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UpdateAttachment_fileKey_key" ON "UpdateAttachment"("fileKey");

-- CreateIndex
CREATE INDEX "UpdateAttachment_updateId_sortOrder_idx" ON "UpdateAttachment"("updateId", "sortOrder");

-- AddForeignKey
ALTER TABLE "UpdateAttachment" ADD CONSTRAINT "UpdateAttachment_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "ProjectUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
