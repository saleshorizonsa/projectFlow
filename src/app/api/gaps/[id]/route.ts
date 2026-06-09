import { NextResponse } from "next/server";
import { calculateGapImpact } from "@/lib/gap-impact";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { gapUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  const parsed = gapUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid gap data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { impact: _ignoredImpact, ...data } = parsed.data;
  const gap = await getPrisma().gap.update({
    where: { id },
    data: {
      ...data,
      ...(data.severity ? { impact: calculateGapImpact(data.severity) } : {}),
      updatedBy: session.user.id,
    },
  });

  return NextResponse.json(gap);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  await getPrisma().gap.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
