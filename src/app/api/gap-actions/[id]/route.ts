import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { gapActionUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("TEAM_MEMBER");
  const { id } = await context.params;
  const parsed = gapActionUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action plan data", details: parsed.error.flatten() }, { status: 400 });
  }

  const action = await getPrisma().gapAction.update({
    where: { id },
    data: { ...parsed.data, updatedBy: session.user.id },
    include: { responsiblePerson: true },
  });

  return NextResponse.json(action);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  await getPrisma().gapAction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
