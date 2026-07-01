import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { IncidentStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const incident = await getPrisma().incident.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      timeline: {
        include: { performedBy: { select: { id: true, name: true } } },
        orderBy: { occurredAt: "asc" },
      },
      review: {
        include: { reviewedBy: { select: { id: true, name: true } } },
      },
      assets: {
        include: { asset: { select: { id: true, assetTag: true, name: true } } },
      },
      vulnerabilities: {
        include: {
          vulnerability: {
            select: { id: true, vulnId: true, title: true, severity: true },
          },
        },
      },
      risks: {
        include: {
          risk: { select: { id: true, riskId: true, title: true, riskScore: true } },
        },
      },
    },
  });

  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  return NextResponse.json(incident);
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const existing = await getPrisma().incident.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { status, ...rest } = body;

  const statusTimestamps: Record<string, Date | undefined> = {};
  if (status) {
    if (status === IncidentStatus.CONTAINED && !existing.containedAt) {
      statusTimestamps.containedAt = new Date();
    }
    if (status === IncidentStatus.ERADICATED && !existing.eradicatedAt) {
      statusTimestamps.eradicatedAt = new Date();
    }
    if (status === IncidentStatus.RECOVERED && !existing.recoveredAt) {
      statusTimestamps.recoveredAt = new Date();
    }
    if (status === IncidentStatus.CLOSED && !existing.closedAt) {
      statusTimestamps.closedAt = new Date();
    }
  }

  const incident = await getPrisma().incident.update({
    where: { id },
    data: {
      ...rest,
      ...(status !== undefined ? { status } : {}),
      ...statusTimestamps,
      updatedBy: session.user.id,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(incident);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;

  const existing = await getPrisma().incident.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  await getPrisma().incident.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
