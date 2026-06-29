import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { itLicenseSchema } from "@/lib/validators";

export async function GET() {
  await requireRole("VIEWER");
  const licenses = await getPrisma().iTLicense.findMany({
    select: { id: true, licenseId: true, name: true, vendor: true, employeeId: true, assetId: true, expiryDate: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(licenses);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");
  const parsed = itLicenseSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid license data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { assetId, employeeId, ...payload } = parsed.data;
  if (employeeId) {
    const employee = await getPrisma().employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: "Employee assignee does not exist." }, { status: 400 });
  }
  const license = await getPrisma().iTLicense.create({
    data: {
      ...payload,
      assetId: assetId || null,
      employeeId: employeeId || null,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(license, { status: 201 });
}
