import { NextResponse } from "next/server";
import { findAllocationConflicts, isOutsideOfficeTime } from "@/lib/resource-planning";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { resourceAllocationSchema } from "@/lib/validators";

export async function GET() {
  await requireRole("VIEWER");
  const allocations = await getPrisma().resourceAllocation.findMany({
    include: { user: true, project: true, task: true, maintenance: true },
    orderBy: { startAt: "asc" },
  });
  return NextResponse.json(allocations);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");
  const parsed = resourceAllocationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resource allocation", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return NextResponse.json({ error: "Selected resource does not exist." }, { status: 400 });

  const conflicts = await findAllocationConflicts(payload.userId, payload.startAt, payload.endAt, undefined, prisma);
  const allocation = await prisma.resourceAllocation.create({
    data: {
      ...payload,
      projectId: payload.projectId || null,
      taskId: payload.taskId || null,
      maintenanceId: payload.maintenanceId || null,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({
    allocation,
    warnings: [
      ...conflicts.map((conflict) => `Resource is already allocated to ${conflict}.`),
      ...(isOutsideOfficeTime(payload.startAt, payload.endAt) ? ["After-hours allocation recorded. This work is outside 08:00-17:00, Sunday to Thursday."] : []),
    ],
  }, { status: 201 });
}
