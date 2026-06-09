import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { projectCurrentStateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = projectCurrentStateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid current state data", details: parsed.error.flatten() }, { status: 400 });
  }

  const project = await getPrisma().project.findUnique({ where: { id }, select: { id: true } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const payload = parsed.data;
  const currentState = await getPrisma().projectCurrentState.upsert({
    where: { projectId: id },
    update: {
      ...payload,
      updatedBy: session.user.id,
    },
    create: {
      ...payload,
      projectId: id,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(currentState);
}
