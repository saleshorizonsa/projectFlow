import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

const postSchema = z.object({
  controlId: z.string().min(1),
});

const deleteSchema = z.object({
  controlIds: z.array(z.string().min(1)),
});

export async function POST(request: Request, context: RouteContext) {
  await requireRole("PROJECT_MANAGER");
  const { id: policyId } = await context.params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { controlId } = parsed.data;

  const prisma = getPrisma();

  const policy = await prisma.policy.findUnique({ where: { id: policyId } });
  if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mapping = await prisma.policyControl.upsert({
    where: { policyId_controlId: { policyId, controlId } },
    create: { policyId, controlId },
    update: {},
  });

  return NextResponse.json(mapping, { status: 201 });
}

export async function DELETE(request: Request, context: RouteContext) {
  await requireRole("PROJECT_MANAGER");
  const { id: policyId } = await context.params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { controlIds } = parsed.data;

  const prisma = getPrisma();

  const policy = await prisma.policy.findUnique({ where: { id: policyId } });
  if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.policyControl.deleteMany({ where: { policyId } }),
    prisma.policyControl.createMany({
      data: controlIds.map((controlId) => ({ policyId, controlId })),
      skipDuplicates: true,
    }),
  ]);

  const controls = await prisma.policyControl.findMany({ where: { policyId } });
  return NextResponse.json(controls);
}
