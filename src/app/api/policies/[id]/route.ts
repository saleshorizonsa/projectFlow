import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { PolicyStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  policyId: z.string().min(2).optional(),
  title: z.string().min(2).optional(),
  category: z.string().min(1).optional(),
  status: z.nativeEnum(PolicyStatus).optional(),
  version: z.string().optional(),
  description: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
  effectiveDate: z.string().datetime().optional().nullable(),
  reviewDate: z.string().datetime().optional().nullable(),
  approverId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
});

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const prisma = getPrisma();

  const policy = await prisma.policy.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { publishedAt: "desc" } },
      acknowledgements: {
        include: {
          employee: { select: { id: true, name: true, employeeId: true } },
        },
      },
      controls: {
        include: {
          control: {
            select: {
              id: true,
              controlId: true,
              title: true,
              domain: { select: { name: true, code: true } },
            },
          },
        },
      },
    },
  });

  if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(policy);
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const prisma = getPrisma();
  const existing = await prisma.policy.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { effectiveDate, reviewDate, status, ...rest } = parsed.data;

  const updated = await prisma.policy.update({
    where: { id },
    data: {
      ...rest,
      status,
      ...(effectiveDate !== undefined
        ? { effectiveDate: effectiveDate ? new Date(effectiveDate) : null }
        : {}),
      ...(reviewDate !== undefined
        ? { reviewDate: reviewDate ? new Date(reviewDate) : null }
        : {}),
      ...(status === "APPROVED" ? { approvedAt: new Date() } : {}),
      updatedBy: session.user.id,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;

  const prisma = getPrisma();
  const existing = await prisma.policy.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.policy.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
