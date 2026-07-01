import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { RiskTreatment, RiskStatus } from "@prisma/client";

const riskSchema = z.object({
  riskId: z.string().min(3),
  title: z.string().min(3),
  description: z.string().min(5),
  category: z.string().min(1),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  treatment: z.nativeEnum(RiskTreatment),
  treatmentPlan: z.string().optional(),
  residualLikelihood: z.number().int().min(1).max(5).optional(),
  residualImpact: z.number().int().min(1).max(5).optional(),
  status: z.nativeEnum(RiskStatus),
  ownerId: z.string().min(1),
  assetId: z.string().optional(),
  controlId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  companyId: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const ownerId = searchParams.get("ownerId") ?? undefined;

  const risks = await getPrisma().risk.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      ...(status ? { status: status as RiskStatus } : {}),
      ...(ownerId ? { ownerId } : {}),
    },
    include: {
      owner: { select: { id: true, name: true } },
      asset: { select: { id: true, assetTag: true, name: true } },
      control: { select: { id: true, controlId: true, title: true } },
    },
    orderBy: { riskScore: "desc" },
  });

  return NextResponse.json(risks);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");

  const body = await request.json().catch(() => null);
  const parsed = riskSchema.safeParse(body);
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
    dueDate,
    ...rest
  } = parsed.data;

  const riskScore = likelihood * impact;
  const residualScore =
    residualLikelihood != null && residualImpact != null
      ? residualLikelihood * residualImpact
      : undefined;

  const risk = await getPrisma().risk.create({
    data: {
      ...rest,
      likelihood,
      impact,
      riskScore,
      ...(residualLikelihood != null ? { residualLikelihood } : {}),
      ...(residualImpact != null ? { residualImpact } : {}),
      ...(residualScore != null ? { residualScore } : {}),
      ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      createdBy: session.user.id,
    },
    include: {
      owner: { select: { id: true, name: true } },
      asset: { select: { id: true, assetTag: true, name: true } },
      control: { select: { id: true, controlId: true, title: true } },
    },
  });

  return NextResponse.json(risk, { status: 201 });
}
