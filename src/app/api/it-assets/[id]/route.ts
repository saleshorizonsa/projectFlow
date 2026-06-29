import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { employeeId } = body as { employeeId?: string };

  if (employeeId) {
    const employee = await getPrisma().employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 400 });
  }

  const asset = await getPrisma().iTAsset.update({
    where: { id },
    data: { employeeId: employeeId || null, updatedBy: session.user.id },
  });

  return NextResponse.json(asset);
}
