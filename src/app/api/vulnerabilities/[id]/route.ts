import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { VulnSeverity, VulnStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const CLOSED_STATUSES = new Set<VulnStatus>([
  VulnStatus.REMEDIATED,
  VulnStatus.ACCEPTED_RISK,
  VulnStatus.FALSE_POSITIVE,
]);

const vulnUpdateSchema = z.object({
  vulnId: z.string().min(2).optional(),
  title: z.string().min(3).optional(),
  description: z.string().min(5).optional(),
  severity: z.nativeEnum(VulnSeverity).optional(),
  status: z.nativeEnum(VulnStatus).optional(),
  cveId: z.string().optional().nullable(),
  cvssScore: z.number().optional().nullable(),
  affectedComponent: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  remediation: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  assetId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  controlId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const existing = await getPrisma().vulnerability.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = vulnUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid vulnerability data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { dueDate, status, cvssScore, ...rest } = parsed.data;

  const isNowClosed = status !== undefined && CLOSED_STATUSES.has(status);
  const wasAlreadyClosed =
    existing.status !== undefined && CLOSED_STATUSES.has(existing.status as VulnStatus);

  const vulnerability = await getPrisma().vulnerability.update({
    where: { id },
    data: {
      ...rest,
      ...(status !== undefined ? { status } : {}),
      ...(isNowClosed && !wasAlreadyClosed ? { closedAt: new Date() } : {}),
      // If moving back to an open status, clear closedAt
      ...(!isNowClosed && status !== undefined ? { closedAt: null } : {}),
      ...(cvssScore !== undefined ? { cvssScore } : {}),
      ...(dueDate !== undefined
        ? { dueDate: dueDate ? new Date(dueDate) : null }
        : {}),
      updatedBy: session.user.id,
    },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      control: { select: { id: true, controlId: true, title: true } },
    },
  });

  return NextResponse.json(vulnerability);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;

  const existing = await getPrisma().vulnerability.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
  }

  await getPrisma().vulnerability.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
