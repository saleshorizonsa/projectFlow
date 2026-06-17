-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SLA_BREACH';
ALTER TYPE "NotificationType" ADD VALUE 'LICENSE_EXPIRING';
ALTER TYPE "NotificationType" ADD VALUE 'ASSET_LIFECYCLE';
ALTER TYPE "NotificationType" ADD VALUE 'MAINTENANCE_DUE';
ALTER TYPE "NotificationType" ADD VALUE 'AUTOMATION';

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "firstResponseDueAt" TIMESTAMP(3),
ADD COLUMN     "resolveDueAt" TIMESTAMP(3),
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "slaBreached" BOOLEAN NOT NULL DEFAULT false;
