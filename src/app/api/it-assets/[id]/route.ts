import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { itAssetUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const parsed = itAssetUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid asset data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { companyIds, assignedToId, employeeId, ...payload } = parsed.data;

  // Validate company IDs if provided
  if (companyIds) {
    const companies = await getPrisma().company.findMany({ where: { id: { in: companyIds }, active: true } });
    if (companies.length !== companyIds.length) {
      return NextResponse.json({ error: "One or more selected companies are unavailable." }, { status: 400 });
    }
  }

  if (assignedToId && assignedToId !== "none") {
    const user = await getPrisma().user.findUnique({ where: { id: assignedToId } });
    if (!user) return NextResponse.json({ error: "Assigned user does not exist." }, { status: 400 });
  }

  if (employeeId && employeeId !== "none") {
    const employee = await getPrisma().employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: "Employee custodian does not exist." }, { status: 400 });
  }

  // Check assetTag uniqueness if changing it
  if (payload.assetTag) {
    const existing = await getPrisma().iTAsset.findUnique({ where: { assetTag: payload.assetTag } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "Asset tag already in use by another asset." }, { status: 409 });
    }
  }

  const asset = await getPrisma().iTAsset.update({
    where: { id },
    data: {
      ...payload,
      ...(assignedToId !== undefined ? { assignedToId: assignedToId === "none" ? null : assignedToId } : {}),
      ...(employeeId !== undefined ? { employeeId: employeeId === "none" ? null : employeeId } : {}),
      ...(companyIds ? {
        companies: {
          deleteMany: {},
          create: companyIds.map((companyId) => ({ companyId, createdBy: session.user.id })),
        },
      } : {}),
      updatedBy: session.user.id,
    },
    include: { assignedTo: true, employee: true, companies: { include: { company: true } } },
  });

  return NextResponse.json(asset);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;
  await getPrisma().iTAsset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
