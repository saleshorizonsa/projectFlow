import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { gapActionSchema } from "@/lib/validators";

export async function GET() {
  await requireRole("VIEWER");
  const actions = await getPrisma().gapAction.findMany({
    include: { gap: { include: { project: true } }, responsiblePerson: true },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json(actions);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");
  const parsed = gapActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action plan data", details: parsed.error.flatten() }, { status: 400 });
  }

  const gap = await getPrisma().gap.findUnique({ where: { id: parsed.data.gapId } });
  if (!gap) {
    return NextResponse.json({ error: "Gap not found" }, { status: 404 });
  }

  const action = await getPrisma().gapAction.create({
    data: { ...parsed.data, createdBy: session.user.id },
    include: { responsiblePerson: true },
  });

  return NextResponse.json(action, { status: 201 });
}
