import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { resourceAllocationUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  const parsed = resourceAllocationUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resource allocation", details: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data;
  const allocation = await getPrisma().resourceAllocation.update({
    where: { id },
    data: {
      ...payload,
      projectId: payload.projectId === "" ? null : payload.projectId,
      taskId: payload.taskId === "" ? null : payload.taskId,
      maintenanceId: payload.maintenanceId === "" ? null : payload.maintenanceId,
      updatedBy: session.user.id,
    },
  });
  return NextResponse.json(allocation);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  await getPrisma().resourceAllocation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
