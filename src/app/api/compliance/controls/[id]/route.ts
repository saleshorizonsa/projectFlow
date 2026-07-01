import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

const controlUpdateSchema = z.object({
  status: z
    .enum([
      "NOT_ASSESSED",
      "COMPLIANT",
      "PARTIALLY_COMPLIANT",
      "NON_COMPLIANT",
      "NOT_APPLICABLE",
    ])
    .optional(),
  implementationNotes: z.string().optional(),
  responsibleId: z.string().nullable().optional(),
  lastAssessedAt: z.coerce.date().nullable().optional(),
  nextReviewAt: z.coerce.date().nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = controlUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid control data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await getPrisma().complianceControl.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Control not found" }, { status: 404 });
  }

  const control = await getPrisma().complianceControl.update({
    where: { id },
    data: {
      ...parsed.data,
      updatedBy: session.user.id,
    },
    include: {
      domain: true,
      responsible: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  return NextResponse.json(control);
}
