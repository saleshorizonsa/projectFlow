import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { BackupFrequency, BackupStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  jobId: z.string().min(2).optional(),
  name: z.string().min(2).optional(),
  frequency: z.nativeEnum(BackupFrequency).optional(),
  rpoHours: z.number().int().min(1).optional(),
  retentionDays: z.number().int().min(1).optional(),
  assetId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  nextRunAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  lastStatus: z.nativeEnum(BackupStatus).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const prisma = getPrisma();
  const existing = await prisma.backupJob.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { nextRunAt, ...rest } = parsed.data;

  const updated = await prisma.backupJob.update({
    where: { id },
    data: {
      ...rest,
      ...(nextRunAt !== undefined ? { nextRunAt: nextRunAt ? new Date(nextRunAt) : null } : {}),
      updatedBy: session.user.id,
    },
  });

  const serialized = JSON.parse(
    JSON.stringify(updated, (_, v) => (typeof v === "bigint" ? Number(v) : v))
  );
  return NextResponse.json(serialized);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;

  const prisma = getPrisma();
  const existing = await prisma.backupJob.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.backupJob.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
