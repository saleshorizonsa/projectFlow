import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { employeeUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  const parsed = employeeUpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid employee data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { companyIds, email, ipAddress, vpnUserId, vpnPassword, ...payload } = parsed.data;
  if (companyIds) {
    const companies = await getPrisma().company.findMany({ where: { id: { in: companyIds }, active: true } });
    if (companies.length !== companyIds.length) {
      return NextResponse.json({ error: "One or more selected companies are unavailable." }, { status: 400 });
    }
  }

  const employee = await getPrisma().employee.update({
    where: { id },
    data: {
      ...payload,
      email: email === "" ? null : email,
      ...(ipAddress !== undefined ? { ipAddress: ipAddress === "" ? null : ipAddress } : {}),
      ...(vpnUserId !== undefined ? { vpnUserId: vpnUserId === "" ? null : vpnUserId } : {}),
      ...(vpnPassword !== undefined ? { vpnPassword: vpnPassword === "" ? null : vpnPassword } : {}),
      updatedBy: session.user.id,
      ...(companyIds ? {
        companies: {
          deleteMany: {},
          create: companyIds.map((companyId) => ({ companyId, createdBy: session.user.id })),
        },
      } : {}),
    },
    include: { companies: { include: { company: true } }, assets: true, licenses: true },
  });

  return NextResponse.json(employee);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;
  await getPrisma().$transaction([
    getPrisma().iTAsset.updateMany({ where: { employeeId: id }, data: { employeeId: null } }),
    getPrisma().iTLicense.updateMany({ where: { employeeId: id }, data: { employeeId: null } }),
    getPrisma().employee.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
