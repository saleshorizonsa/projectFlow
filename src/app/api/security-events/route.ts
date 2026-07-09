import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security-events";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const hours = parseInt(searchParams.get("hours") ?? "24", 10);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const PAGE_SIZE = 50;

  const since = hours > 0 ? new Date(Date.now() - hours * 3_600_000) : undefined;

  const where = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(type ? { type: type as any } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(severity ? { severity: severity as any } : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const [events, total, kpi] = await Promise.all([
    getPrisma().securityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    getPrisma().securityEvent.count({ where }),
    getPrisma().securityEvent.groupBy({
      by: ["severity"],
      _count: { id: true },
      where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
  ]);

  return NextResponse.json({ events, total, kpi });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.type || !body?.description) {
    return NextResponse.json({ error: "type and description are required" }, { status: 400 });
  }

  await logSecurityEvent({
    type: body.type,
    severity: body.severity,
    actor: body.actor ?? (session.user.email ?? undefined),
    actorIp: body.actorIp,
    resource: body.resource,
    resourceId: body.resourceId,
    description: body.description,
    metadata: body.metadata,
    mitreTactic: body.mitreTactic,
    companyId: body.companyId,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
