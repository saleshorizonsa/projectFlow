import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { taskSchema } from "@/lib/validators";

export async function GET() {
  await requireRole("VIEWER");
  const tasks = await getPrisma().task.findMany({
    include: { project: true, assignee: true, layer: true, subLayer: true },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");
  const parsed = taskSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task data", details: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data;
  if (payload.taskType === "PROJECT") {
    const layer = await getPrisma().projectLayer.findFirst({
      where: { id: payload.layerId, projectId: payload.projectId, subLayers: { some: { id: payload.subLayerId } } },
    });
    if (!layer) {
      return NextResponse.json({ error: "Layer and sublayer must belong to the selected project" }, { status: 400 });
    }
  }

  const task = await getPrisma().task.create({
    data: {
      ...payload,
      projectId: payload.taskType === "PROJECT" ? payload.projectId : null,
      layerId: payload.taskType === "PROJECT" ? payload.layerId : null,
      subLayerId: payload.taskType === "PROJECT" ? payload.subLayerId : null,
      createdBy: session.user.id,
    },
  });
  return NextResponse.json(task, { status: 201 });
}
