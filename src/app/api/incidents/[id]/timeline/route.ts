import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const incident = await getPrisma().incident.findUnique({ where: { id } });
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const timeline = await getPrisma().incidentTimeline.findMany({
    where: { incidentId: id },
    include: { performedBy: { select: { id: true, name: true } } },
    orderBy: { occurredAt: "asc" },
  });

  return NextResponse.json(timeline);
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const incident = await getPrisma().incident.findUnique({ where: { id } });
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const { action, detail, occurredAt } = body;

  const entry = await getPrisma().incidentTimeline.create({
    data: {
      incidentId: id,
      action,
      ...(detail !== undefined ? { detail } : {}),
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      performedById: session.user.id,
    },
    include: { performedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(entry, { status: 201 });
}
