import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

const evidenceCreateSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  mimeType: z.string().optional(),
  size: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  await requireRole("VIEWER");
  const { id } = await context.params;

  const control = await getPrisma().complianceControl.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!control) {
    return NextResponse.json({ error: "Control not found" }, { status: 404 });
  }

  const evidences = await getPrisma().controlEvidence.findMany({
    where: { controlId: id },
    include: {
      uploadedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(evidences);
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const control = await getPrisma().complianceControl.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!control) {
    return NextResponse.json({ error: "Control not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = evidenceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid evidence data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const evidence = await getPrisma().controlEvidence.create({
    data: {
      ...parsed.data,
      controlId: id,
      uploadedById: session.user.id,
      createdBy: session.user.id,
    },
    include: {
      uploadedBy: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(evidence, { status: 201 });
}
