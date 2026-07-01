import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request, context: RouteContext) {
  await requireRole("PROJECT_MANAGER");
  const { id: policyId } = await context.params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { employeeIds } = parsed.data;

  const prisma = getPrisma();

  const policy = await prisma.policy.findUnique({ where: { id: policyId } });
  if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await prisma.policyAcknowledgement.createMany({
    data: employeeIds.map((employeeId) => ({
      policyId,
      employeeId,
      status: "PENDING" as const,
      sentAt: new Date(),
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ sent: result.count });
}
