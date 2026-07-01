import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { BackupFrequency } from "@prisma/client";

const createSchema = z.object({
  jobId: z.string().min(2),
  name: z.string().min(2),
  frequency: z.nativeEnum(BackupFrequency),
  rpoHours: z.number().int().min(1),
  retentionDays: z.number().int().min(1),
  assetId: z.string().optional(),
  notes: z.string().optional(),
  companyId: z.string().optional(),
  nextRunAt: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const isActiveParam = searchParams.get("isActive");
  const companyId = searchParams.get("companyId");

  const where: Record<string, unknown> = {};
  if (isActiveParam === "true") where.isActive = true;
  if (isActiveParam === "false") where.isActive = false;
  if (companyId) where.companyId = companyId;

  const prisma = getPrisma();
  const jobs = await prisma.backupJob.findMany({
    where,
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      logs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const serialized = JSON.parse(
    JSON.stringify(jobs, (_, v) => (typeof v === "bigint" ? Number(v) : v))
  );
  return NextResponse.json(serialized);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { nextRunAt, ...rest } = parsed.data;
  const prisma = getPrisma();

  const job = await prisma.backupJob.create({
    data: {
      ...rest,
      nextRunAt: nextRunAt ? new Date(nextRunAt) : undefined,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    },
  });

  const serialized = JSON.parse(
    JSON.stringify(job, (_, v) => (typeof v === "bigint" ? Number(v) : v))
  );
  return NextResponse.json(serialized, { status: 201 });
}
