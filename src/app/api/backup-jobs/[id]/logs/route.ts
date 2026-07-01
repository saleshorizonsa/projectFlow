import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { BackupStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const createLogSchema = z.object({
  status: z.nativeEnum(BackupStatus),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().optional(),
  sizeBytes: z.number().optional(),
  errorMessage: z.string().optional(),
});

export async function GET(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const prisma = getPrisma();
  const job = await prisma.backupJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = await prisma.backupLog.findMany({
    where: { jobId: id },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  const serialized = JSON.parse(
    JSON.stringify(logs, (_, v) => (typeof v === "bigint" ? Number(v) : v))
  );
  return NextResponse.json(serialized);
}

export async function POST(request: Request, context: RouteContext) {
  await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const prisma = getPrisma();
  const job = await prisma.backupJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = createLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { status, startedAt, completedAt, durationMinutes, sizeBytes, errorMessage } = parsed.data;

  const [log] = await prisma.$transaction([
    prisma.backupLog.create({
      data: {
        jobId: id,
        status,
        startedAt: new Date(startedAt),
        completedAt: completedAt ? new Date(completedAt) : undefined,
        durationMinutes,
        sizeBytes: sizeBytes !== undefined ? BigInt(Math.round(sizeBytes)) : undefined,
        errorMessage,
      },
    }),
    prisma.backupJob.update({
      where: { id },
      data: {
        lastRunAt: new Date(startedAt),
        lastStatus: status,
        lastSizeBytes: sizeBytes !== undefined ? BigInt(Math.round(sizeBytes)) : undefined,
      },
    }),
  ]);

  const serialized = JSON.parse(
    JSON.stringify(log, (_, v) => (typeof v === "bigint" ? Number(v) : v))
  );
  return NextResponse.json(serialized, { status: 201 });
}
