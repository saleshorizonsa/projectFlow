import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { itAssetSchema } from "@/lib/validators";

export async function GET() {
  await requireRole("VIEWER");
  const assets = await getPrisma().iTAsset.findMany({
    include: { assignedTo: true, companies: { include: { company: true } }, maintenances: true, licenses: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(assets);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");
  const parsed = itAssetSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid asset data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { companyIds, assignedToId, employeeId, ...payload } = parsed.data;
  const companies = await getPrisma().company.findMany({
    where: { id: { in: companyIds }, active: true },
  });

  if (companies.length !== companyIds.length) {
    return NextResponse.json({ error: "One or more selected companies are unavailable." }, { status: 400 });
  }
  if (assignedToId) {
    const assignedTo = await getPrisma().user.findUnique({ where: { id: assignedToId } });
    if (!assignedTo) return NextResponse.json({ error: "Assigned user does not exist." }, { status: 400 });
  }
  if (employeeId) {
    const employee = await getPrisma().employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: "Employee custodian does not exist." }, { status: 400 });
  }

  const asset = await getPrisma().iTAsset.create({
    data: {
      ...payload,
      assignedToId: assignedToId || null,
      employeeId: employeeId || null,
      createdBy: session.user.id,
      companies: {
        create: companyIds.map((companyId) => ({ companyId, createdBy: session.user.id })),
      },
    },
  });

  return NextResponse.json(asset, { status: 201 });
}
