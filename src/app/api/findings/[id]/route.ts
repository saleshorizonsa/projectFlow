import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { FindingSeverity, FindingStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const CLOSED_STATUSES = new Set<FindingStatus>([
  "RESOLVED",
  "ACCEPTED",
  "CLOSED",
]);

const findingUpdateSchema = z.object({
  findingId: z.string().min(3).optional(),
  title: z.string().min(3).optional(),
  description: z.string().min(5).optional(),
  severity: z.nativeEnum(FindingSeverity).optional(),
  status: z.nativeEnum(FindingStatus).optional(),
  controlId: z.string().nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  closedAt: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const existing = await getPrisma().auditFinding.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = findingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid finding data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Auto-set closedAt when transitioning to a closed status
  const newStatus = data.status;
  const isBeingClosed =
    newStatus !== undefined &&
    CLOSED_STATUSES.has(newStatus) &&
    !CLOSED_STATUSES.has(existing.status);

  const closedAt =
    data.closedAt !== undefined
      ? data.closedAt
      : isBeingClosed
        ? new Date()
        : undefined;

  const finding = await getPrisma().auditFinding.update({
    where: { id },
    data: {
      ...data,
      ...(closedAt !== undefined ? { closedAt } : {}),
      updatedBy: session.user.id,
    },
    include: {
      control: {
        select: { controlId: true, title: true },
      },
      responsible: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(finding);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;

  const existing = await getPrisma().auditFinding.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  await getPrisma().auditFinding.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
