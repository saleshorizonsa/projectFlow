import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await getPrisma().alertRule.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  await requireRole("PROJECT_MANAGER");

  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.eventType) {
    return NextResponse.json({ error: "name and eventType are required" }, { status: 400 });
  }

  const rule = await getPrisma().alertRule.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      enabled: body.enabled ?? true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventType: body.eventType as any,
      conditionCount: body.conditionCount ?? 1,
      conditionWindowMin: body.conditionWindowMin ?? 60,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      severity: (body.severity ?? "HIGH") as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      action: (body.action ?? "CREATE_INCIDENT") as any,
      incidentTitle: body.incidentTitle ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      incidentSeverity: (body.incidentSeverity ?? null) as any,
      mitreTactic: body.mitreTactic ?? null,
      mitreTechnique: body.mitreTechnique ?? null,
      companyId: body.companyId ?? null,
    },
  });
  return NextResponse.json(rule, { status: 201 });
}
