-- AlterTable
ALTER TABLE "ITAsset" ADD COLUMN     "disposalDate" TIMESTAMP(3),
ADD COLUMN     "disposalMethod" TEXT,
ADD COLUMN     "sanitizationMethod" TEXT,
ADD COLUMN     "sanitizationStatus" TEXT,
ADD COLUMN     "disposalCertificate" TEXT,
ADD COLUMN     "decommissionedBy" TEXT,
ADD COLUMN     "disposalNotes" TEXT;

-- CreateTable
CREATE TABLE "AssetLifecycleEvent" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "AssetLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetLifecycleEvent_assetId_idx" ON "AssetLifecycleEvent"("assetId");

-- AddForeignKey
ALTER TABLE "AssetLifecycleEvent" ADD CONSTRAINT "AssetLifecycleEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ITAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
