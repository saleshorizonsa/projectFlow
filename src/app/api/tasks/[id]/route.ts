import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { taskUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("TEAM_MEMBER");
  const { id } = await context.params;
  const parsed = taskUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task data", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.projectId || parsed.data.layerId || parsed.data.subLayerId) {
    const existing = await getPrisma().task.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const projectId = parsed.data.projectId ?? existing.projectId;
    const layerId = parsed.data.layerId ?? existing.layerId;
    const subLayerId = parsed.data.subLayerId ?? existing.subLayerId;
    const layer = await getPrisma().projectLayer.findFirst({
      where: { id: layerId, projectId, subLayers: { some: { id: subLayerId } } },
    });
    if (!layer) {
      return NextResponse.json({ error: "Layer and sublayer must belong to the selected project" }, { status: 400 });
    }
  }

  const task = await getPrisma().task.update({
    where: { id },
    data: { ...parsed.data, updatedBy: session.user.id },
  });

  return NextResponse.json(task);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  await getPrisma().task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
