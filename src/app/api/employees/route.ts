import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { employeeSchema } from "@/lib/validators";

export async function GET() {
  await requireRole("VIEWER");
  const employees = await getPrisma().employee.findMany({
    include: {
      companies: { include: { company: true } },
      assets: true,
      licenseAssignments: { include: { license: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(employees);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");
  const parsed = employeeSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid employee data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { companyIds, email, ...payload } = parsed.data;
  const companies = await getPrisma().company.findMany({ where: { id: { in: companyIds }, active: true } });
  if (companies.length !== companyIds.length) {
    return NextResponse.json({ error: "One or more selected companies are unavailable." }, { status: 400 });
  }

  const employee = await getPrisma().employee.create({
    data: {
      ...payload,
      email: email || null,
      createdBy: session.user.id,
      companies: {
        create: companyIds.map((companyId) => ({ companyId, createdBy: session.user.id })),
      },
    },
    include: { companies: { include: { company: true } }, assets: true, licenseAssignments: { include: { license: true } } },
  });

  return NextResponse.json(employee, { status: 201 });
}
