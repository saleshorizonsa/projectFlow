import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { projectUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  const parsed = projectUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { companyIds, ...projectPayload } = parsed.data;
  let client = projectPayload.client;

  if (companyIds) {
    const companies = await getPrisma().company.findMany({
      where: { id: { in: companyIds }, active: true },
      orderBy: { name: "asc" },
    });

    if (companies.length !== companyIds.length) {
      return NextResponse.json({ error: "One or more selected companies are unavailable." }, { status: 400 });
    }

    client = companies.map((company) => company.name).join(", ");
  }

  const project = await getPrisma().project.update({
    where: { id },
    data: {
      ...projectPayload,
      client,
      updatedBy: session.user.id,
      ...(companyIds ? {
        companies: {
          deleteMany: {},
          create: companyIds.map((companyId) => ({
            companyId,
            createdBy: session.user.id,
          })),
        },
      } : {}),
    },
  });

  return NextResponse.json(project);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;
  await getPrisma().project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
