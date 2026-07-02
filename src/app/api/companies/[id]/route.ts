import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { companyUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("ADMIN");
  const { id } = await context.params;
  const parsed = companyUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid company data", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const company = await getPrisma().company.update({
    where: { id },
    data: {
      ...payload,
      code: payload.code ? payload.code.toUpperCase() : undefined,
      updatedBy: session.user.id,
    },
  });

  return NextResponse.json(company);
}

export async function DELETE(request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  const prisma = getPrisma();

  const [projects, employees, users, assets, tickets, incidents, playbooks] = await Promise.all([
    prisma.projectCompany.count({ where: { companyId: id } }),
    prisma.employeeCompany.count({ where: { companyId: id } }),
    prisma.userCompany.count({ where: { companyId: id } }),
    prisma.iTAssetCompany.count({ where: { companyId: id } }),
    prisma.supportTicket.count({ where: { companyId: id } }),
    prisma.incident.count({ where: { companyId: id } }),
    prisma.incidentPlaybook.count({ where: { companyId: id } }),
  ]);

  const total = projects + employees + users + assets + tickets + incidents + playbooks;

  if (total > 0 && !force) {
    return NextResponse.json(
      {
        error: "Company has linked data",
        links: { projects, employees, users, assets, tickets, incidents, playbooks },
      },
      { status: 409 },
    );
  }

  if (force) {
    // Null out nullable FKs first (no cascade defined)
    await prisma.$transaction([
      prisma.incident.updateMany({ where: { companyId: id }, data: { companyId: null } }),
      prisma.incidentPlaybook.updateMany({ where: { companyId: id }, data: { companyId: null } }),
      // SupportTicket.companyId is non-nullable — delete the tickets
      prisma.supportTicket.deleteMany({ where: { companyId: id } }),
    ]);
  }

  try {
    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Company not found." }, { status: 404 });
    if (code === "P2003") return NextResponse.json({ error: "Company still has linked records. Please use force delete." }, { status: 409 });
    console.error("Company DELETE error:", err);
    return NextResponse.json({ error: "Delete failed. Please try again." }, { status: 500 });
  }
}
