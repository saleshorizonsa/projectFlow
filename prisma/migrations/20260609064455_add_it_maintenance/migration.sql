-- CreateEnum
CREATE TYPE "ITAssetType" AS ENUM ('SERVER', 'ROUTER', 'SWITCH', 'FIREWALL', 'STORAGE', 'LAPTOP', 'DESKTOP', 'PRINTER', 'APPLICATION', 'DATABASE', 'CLOUD_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "ITAssetStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED', 'PLANNED_REPLACEMENT');

-- CreateEnum
CREATE TYPE "ITMaintenanceStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ITAsset" (
    "id" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ITAssetType" NOT NULL,
    "vendor" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "lifecycleYears" INTEGER NOT NULL DEFAULT 5,
    "status" "ITAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "ITAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITMaintenance" (
    "id" TEXT NOT NULL,
    "maintenanceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "ITMaintenanceStatus" NOT NULL DEFAULT 'PLANNED',
    "responsibleId" TEXT NOT NULL,
    "downtimeRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "ITMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ITLicense" (
    "id" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "assetId" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "owner" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "ITLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ITAsset_assetTag_key" ON "ITAsset"("assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "ITMaintenance_maintenanceId_key" ON "ITMaintenance"("maintenanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ITLicense_licenseId_key" ON "ITLicense"("licenseId");

-- AddForeignKey
ALTER TABLE "ITMaintenance" ADD CONSTRAINT "ITMaintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ITAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITMaintenance" ADD CONSTRAINT "ITMaintenance_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ITLicense" ADD CONSTRAINT "ITLicense_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ITAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
