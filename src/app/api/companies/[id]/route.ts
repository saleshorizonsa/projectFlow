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

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;
  const linkCount = await getPrisma().projectCompany.count({ where: { companyId: id } });

  if (linkCount > 0) {
    return NextResponse.json({ error: "Company is linked to projects. Deactivate it instead of deleting." }, { status: 409 });
  }

  await getPrisma().company.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
