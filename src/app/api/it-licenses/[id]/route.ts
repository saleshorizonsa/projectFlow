import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { itLicenseSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("ADMIN");
  const { id } = await context.params;
  const parsed = itLicenseSchema.partial().safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid license data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { assetId, employeeId, ...payload } = parsed.data;
  if (employeeId) {
    const employee = await getPrisma().employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: "Employee assignee does not exist." }, { status: 400 });
  }
  if (assetId) {
    const asset = await getPrisma().iTAsset.findUnique({ where: { id: assetId } });
    if (!asset) return NextResponse.json({ error: "Linked asset does not exist." }, { status: 400 });
  }

  const license = await getPrisma().iTLicense.update({
    where: { id },
    data: {
      ...payload,
      assetId: assetId === "" ? null : assetId,
      employeeId: employeeId === "" ? null : employeeId,
      updatedBy: session.user.id,
    },
  });

  return NextResponse.json(license);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;
  await getPrisma().iTLicense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
