import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; assignmentId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("PROJECT_MANAGER");
  const { assignmentId } = await context.params;
  await getPrisma().licenseAssignment.delete({ where: { id: assignmentId } });
  return NextResponse.json({ ok: true });
}
