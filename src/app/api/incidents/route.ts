import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { IncidentSeverity, IncidentStatus, IncidentType } from "@prisma/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const companyId = searchParams.get("companyId") ?? undefined;

  const incidents = await getPrisma().incident.findMany({
    where: {
      ...(status ? { status: status as IncidentStatus } : {}),
      ...(severity ? { severity: severity as IncidentSeverity } : {}),
      ...(type ? { type: type as IncidentType } : {}),
      ...(companyId ? { companyId } : {}),
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { timeline: true, assets: true } },
    },
    orderBy: { reportedAt: "desc" },
  });

  return NextResponse.json(incidents);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");

  const body = await request.json().catch(() => null);
  if (!body || !body.title || !body.type || !body.severity) {
    return NextResponse.json(
      { error: "title, type, and severity are required" },
      { status: 400 }
    );
  }

  const {
    title,
    type,
    severity,
    incidentId,
    description,
    impact,
    rootCause,
    affectedSystems,
    assignedToId,
    companyId,
    sourceTicketId,
  } = body;

  const incident = await getPrisma().incident.create({
    data: {
      incidentId: incidentId ?? `INC-${Date.now()}`,
      title,
      type,
      severity,
      ...(description !== undefined ? { description } : {}),
      ...(impact !== undefined ? { impact } : {}),
      ...(rootCause !== undefined ? { rootCause } : {}),
      ...(affectedSystems !== undefined ? { affectedSystems } : {}),
      ...(assignedToId !== undefined ? { assignedToId } : {}),
      ...(companyId !== undefined ? { companyId } : {}),
      ...(sourceTicketId !== undefined ? { sourceTicketId } : {}),
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(incident, { status: 201 });
}
