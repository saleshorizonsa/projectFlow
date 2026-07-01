import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { RiskTreatment, RiskStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const riskUpdateSchema = z.object({
  riskId: z.string().min(3).optional(),
  title: z.string().min(3).optional(),
  description: z.string().min(5).optional(),
  category: z.string().min(1).optional(),
  likelihood: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  treatment: z.nativeEnum(RiskTreatment).optional(),
  treatmentPlan: z.string().optional().nullable(),
  residualLikelihood: z.number().int().min(1).max(5).optional().nullable(),
  residualImpact: z.number().int().min(1).max(5).optional().nullable(),
  residualScore: z.number().int().optional().nullable(),
  status: z.nativeEnum(RiskStatus).optional(),
  ownerId: z.string().min(1).optional(),
  assetId: z.string().optional().nullable(),
  controlId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  companyId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const existing = await getPrisma().risk.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Risk not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = riskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid risk data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    likelihood,
    impact,
    residualLikelihood,
    residualImpact,
    residualScore: _ignoredResidualScore,
    dueDate,
    status,
    ...rest
  } = parsed.data;

  // Re-compute riskScore if likelihood or impact changed
  const newLikelihood = likelihood ?? existing.likelihood;
  const newImpact = impact ?? existing.impact;
  const riskScore =
    likelihood != null || impact != null
      ? newLikelihood * newImpact
      : undefined;

  // Re-compute residualScore if residual values change
  const newResidualLikelihood =
    residualLikelihood !== undefined
      ? residualLikelihood
      : existing.residualLikelihood;
  const newResidualImpact =
    residualImpact !== undefined ? residualImpact : existing.residualImpact;
  const computedResidualScore =
    newResidualLikelihood != null && newResidualImpact != null
      ? newResidualLikelihood * newResidualImpact
      : null;

  const risk = await getPrisma().risk.update({
    where: { id },
    data: {
      ...rest,
      ...(likelihood != null ? { likelihood } : {}),
      ...(impact != null ? { impact } : {}),
      ...(riskScore != null ? { riskScore } : {}),
      ...(residualLikelihood !== undefined
        ? { residualLikelihood }
        : {}),
      ...(residualImpact !== undefined ? { residualImpact } : {}),
      residualScore: computedResidualScore,
      ...(status !== undefined ? { status } : {}),
      ...(status === RiskStatus.CLOSED ? { closedAt: new Date() } : {}),
      ...(dueDate !== undefined
        ? { dueDate: dueDate ? new Date(dueDate) : null }
        : {}),
      updatedBy: session.user.id,
    },
    include: {
      owner: { select: { id: true, name: true } },
      asset: { select: { id: true, assetTag: true, name: true } },
      control: { select: { id: true, controlId: true, title: true } },
    },
  });

  return NextResponse.json(risk);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;

  const existing = await getPrisma().risk.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Risk not found" }, { status: 404 });
  }

  await getPrisma().risk.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
