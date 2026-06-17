import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { teamMemberUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("ADMIN");
  const { id } = await context.params;
  const parsed = teamMemberUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid team member data", details: parsed.error.flatten() }, { status: 400 });
  }

  const role = parsed.data.role ? await getPrisma().role.findUnique({ where: { name: parsed.data.role } }) : null;
  if (parsed.data.role && !role) {
    return NextResponse.json({ error: "Selected role does not exist" }, { status: 400 });
  }

  const { companyIds, ...payload } = parsed.data;
  const companies = companyIds ? await getPrisma().company.findMany({ where: { id: { in: companyIds }, active: true } }) : [];
  if (companyIds && companies.length !== companyIds.length) {
    return NextResponse.json({ error: "One or more selected companies are unavailable." }, { status: 400 });
  }

  const passwordHash = payload.password ? await bcrypt.hash(payload.password, 12) : undefined;
  const user = await getPrisma().user.update({
    where: { id },
    data: {
      name: payload.name,
      email: payload.email,
      phone: payload.phone === "" ? null : payload.phone,
      passwordHash,
      roleId: role?.id,
      updatedBy: session.user.id,
      ...(companyIds ? {
        companies: {
          deleteMany: {},
          create: companyIds.map((companyId) => ({ companyId, createdBy: session.user.id })),
        },
      } : {}),
    },
    include: { role: true, companies: { include: { company: true } } },
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role.name,
    companies: user.companies.map((link) => ({ id: link.company.id, name: link.company.name, code: link.company.code })),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const adminSession = await requireRole("ADMIN");
  const session = await auth();
  const { id } = await context.params;

  if (session?.user.id === id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const prisma = getPrisma();
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }

  const reassignedTo = adminSession.user.id;
  await prisma.$transaction([
    prisma.project.updateMany({ where: { managerId: id }, data: { managerId: reassignedTo, updatedBy: reassignedTo } }),
    prisma.task.updateMany({ where: { assigneeId: id }, data: { assigneeId: reassignedTo, updatedBy: reassignedTo } }),
    prisma.gap.updateMany({ where: { ownerId: id }, data: { ownerId: reassignedTo, updatedBy: reassignedTo } }),
    prisma.gapAction.updateMany({ where: { responsibleId: id }, data: { responsibleId: reassignedTo, updatedBy: reassignedTo } }),
    prisma.iTAsset.updateMany({ where: { assignedToId: id }, data: { assignedToId: null, updatedBy: reassignedTo } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true, reassignedTo });
}
