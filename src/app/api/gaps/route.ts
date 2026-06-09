import { NextResponse } from "next/server";
import { calculateGapImpact } from "@/lib/gap-impact";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { gapSchema } from "@/lib/validators";

export async function GET() {
  await requireRole("VIEWER");
  const gaps = await getPrisma().gap.findMany({
    include: { project: true, owner: true, layer: true, subLayer: true, actions: true },
    orderBy: [{ severity: "desc" }, { targetClosureDate: "asc" }],
  });
  return NextResponse.json(gaps);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");
  const parsed = gapSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid gap data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { impact: _ignoredImpact, ...payload } = parsed.data;
  const gap = await getPrisma().gap.create({
    data: {
      ...payload,
      impact: calculateGapImpact(payload.severity),
      createdBy: session.user.id,
    },
  });
  return NextResponse.json(gap, { status: 201 });
}
