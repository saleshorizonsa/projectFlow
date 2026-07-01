import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  employeeId: z.string().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: policyId } = await context.params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { employeeId } = parsed.data;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const prisma = getPrisma();

  const policy = await prisma.policy.findUnique({ where: { id: policyId } });
  if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const acknowledgement = await prisma.policyAcknowledgement.update({
    where: { policyId_employeeId: { policyId, employeeId } },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      ipAddress: ip,
    },
  });

  return NextResponse.json(acknowledgement);
}
