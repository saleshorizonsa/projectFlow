-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('PROJECT', 'GENERAL');

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_layerId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_subLayerId_fkey";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "taskType" "TaskType" NOT NULL DEFAULT 'PROJECT',
ALTER COLUMN "projectId" DROP NOT NULL,
ALTER COLUMN "layerId" DROP NOT NULL,
ALTER COLUMN "subLayerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "ProjectLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_subLayerId_fkey" FOREIGN KEY ("subLayerId") REFERENCES "SubLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
