-- CreateTable
CREATE TABLE "ProjectCurrentState" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "currentProcess" TEXT NOT NULL,
    "tools" TEXT NOT NULL,
    "resources" TEXT NOT NULL,
    "painPoints" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "constraints" TEXT NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL,
    "assessedById" TEXT NOT NULL,
    "confidenceLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "ProjectCurrentState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCurrentState_projectId_key" ON "ProjectCurrentState"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectCurrentState" ADD CONSTRAINT "ProjectCurrentState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCurrentState" ADD CONSTRAINT "ProjectCurrentState_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
