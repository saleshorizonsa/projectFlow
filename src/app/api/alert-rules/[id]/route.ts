import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("PROJECT_MANAGER");
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const rule = await getPrisma().alertRule.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(body.eventType !== undefined ? { eventType: body.eventType as any } : {}),
      ...(body.conditionCount !== undefined ? { conditionCount: body.conditionCount } : {}),
      ...(body.conditionWindowMin !== undefined ? { conditionWindowMin: body.conditionWindowMin } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(body.severity !== undefined ? { severity: body.severity as any } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(body.action !== undefined ? { action: body.action as any } : {}),
      ...(body.incidentTitle !== undefined ? { incidentTitle: body.incidentTitle } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(body.incidentSeverity !== undefined ? { incidentSeverity: body.incidentSeverity as any } : {}),
      ...(body.mitreTactic !== undefined ? { mitreTactic: body.mitreTactic } : {}),
      ...(body.mitreTechnique !== undefined ? { mitreTechnique: body.mitreTechnique } : {}),
    },
  });
  return NextResponse.json(rule);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("ADMIN");
  const { id } = await params;
  await getPrisma().alertRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
