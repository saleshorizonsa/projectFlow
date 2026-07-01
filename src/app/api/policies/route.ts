import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { PolicyStatus } from "@prisma/client";

const createSchema = z.object({
  policyId: z.string().min(2),
  title: z.string().min(2),
  category: z.string().min(1),
  status: z.nativeEnum(PolicyStatus).default("DRAFT"),
  version: z.string().default("1.0"),
  description: z.string().optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  effectiveDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
  approverId: z.string().optional(),
  companyId: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const prisma = getPrisma();
  const policies = await prisma.policy.findMany({
    where,
    include: {
      approver: { select: { id: true, name: true } },
      _count: { select: { acknowledgements: true, controls: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(policies);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { effectiveDate, reviewDate, ...rest } = parsed.data;

  const prisma = getPrisma();
  const policy = await prisma.policy.create({
    data: {
      ...rest,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
      reviewDate: reviewDate ? new Date(reviewDate) : undefined,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    },
  });

  return NextResponse.json(policy, { status: 201 });
}
