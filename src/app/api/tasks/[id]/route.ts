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

  const existing = await getPrisma().task.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const nextTaskType = parsed.data.taskType ?? existing.taskType;

  if (nextTaskType === "PROJECT" && (parsed.data.projectId || parsed.data.layerId || parsed.data.subLayerId || parsed.data.taskType)) {
    const projectId = parsed.data.projectId ?? existing.projectId;
    const layerId = parsed.data.layerId ?? existing.layerId;
    const subLayerId = parsed.data.subLayerId ?? existing.subLayerId;
    if (!projectId || !layerId || !subLayerId) {
      return NextResponse.json({ error: "Project tasks require project, layer, and sublayer." }, { status: 400 });
    }
    const layer = await getPrisma().projectLayer.findFirst({
      where: { id: layerId, projectId, subLayers: { some: { id: subLayerId } } },
    });
    if (!layer) {
      return NextResponse.json({ error: "Layer and sublayer must belong to the selected project" }, { status: 400 });
    }
  }

  const task = await getPrisma().task.update({
    where: { id },
    data: {
      ...parsed.data,
      projectId: nextTaskType === "PROJECT" ? parsed.data.projectId : parsed.data.taskType === "GENERAL" ? null : undefined,
      layerId: nextTaskType === "PROJECT" ? parsed.data.layerId : parsed.data.taskType === "GENERAL" ? null : undefined,
      subLayerId: nextTaskType === "PROJECT" ? parsed.data.subLayerId : parsed.data.taskType === "GENERAL" ? null : undefined,
      updatedBy: session.user.id,
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  await getPrisma().task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
