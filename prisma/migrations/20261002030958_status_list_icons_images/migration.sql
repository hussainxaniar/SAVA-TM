-- AlterTable
ALTER TABLE "List" ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "Status" ADD COLUMN     "icon" TEXT;

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Image_spaceId_idx" ON "Image"("spaceId");
