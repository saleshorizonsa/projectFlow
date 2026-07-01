import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const pir = await getPrisma().postIncidentReview.findUnique({
    where: { incidentId: id },
    include: { reviewedBy: { select: { id: true, name: true } } },
  });

  if (!pir) {
    return NextResponse.json({ error: "Post-incident review not found" }, { status: 404 });
  }

  return NextResponse.json(pir);
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const incident = await getPrisma().incident.findUnique({ where: { id } });
  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const {
    summary,
    timeline,
    rootCause,
    lessonsLearned,
    recommendations,
    reviewedAt,
  } = body ?? {};

  const pir = await getPrisma().postIncidentReview.upsert({
    where: { incidentId: id },
    create: {
      incidentId: id,
      ...(summary !== undefined ? { summary } : {}),
      ...(timeline !== undefined ? { timeline } : {}),
      ...(rootCause !== undefined ? { rootCause } : {}),
      ...(lessonsLearned !== undefined ? { lessonsLearned } : {}),
      ...(recommendations !== undefined ? { recommendations } : {}),
      ...(reviewedAt !== undefined
        ? { reviewedAt: new Date(reviewedAt), reviewedById: session.user.id }
        : {}),
    },
    update: {
      ...(summary !== undefined ? { summary } : {}),
      ...(timeline !== undefined ? { timeline } : {}),
      ...(rootCause !== undefined ? { rootCause } : {}),
      ...(lessonsLearned !== undefined ? { lessonsLearned } : {}),
      ...(recommendations !== undefined ? { recommendations } : {}),
      ...(reviewedAt !== undefined
        ? { reviewedAt: new Date(reviewedAt), reviewedById: session.user.id }
        : {}),
    },
    include: { reviewedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(pir, { status: 201 });
}
