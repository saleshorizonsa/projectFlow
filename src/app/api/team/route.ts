import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { teamMemberSchema } from "@/lib/validators";

export async function GET() {
  await requireRole("PROJECT_MANAGER");
  const users = await getPrisma().user.findMany({
    include: {
      role: true,
      companies: { include: { company: true } },
      assignedAssets: true,
      _count: { select: { assignedTasks: true, gapActions: true, ownedGaps: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role.name,
      assignedTasks: user._count.assignedTasks,
      gapActions: user._count.gapActions,
      ownedGaps: user._count.ownedGaps,
      companies: user.companies.map((link) => ({ id: link.company.id, name: link.company.name, code: link.company.code })),
      assets: user.assignedAssets.map((asset) => ({ id: asset.id, assetTag: asset.assetTag, name: asset.name, type: asset.type })),
      createdAt: user.createdAt.toISOString(),
    })),
  );
}

export async function POST(request: Request) {
  const session = await requireRole("ADMIN");
  const parsed = teamMemberSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid team member data", details: parsed.error.flatten() }, { status: 400 });
  }

  const role = await getPrisma().role.findUnique({ where: { name: parsed.data.role } });
  if (!role) {
    return NextResponse.json({ error: "Selected role does not exist" }, { status: 400 });
  }
  const existing = await getPrisma().user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "A team member with this email already exists" }, { status: 409 });
  }

  const { companyIds, ...payload } = parsed.data;
  const companies = companyIds.length ? await getPrisma().company.findMany({ where: { id: { in: companyIds }, active: true } }) : [];
  if (companies.length !== companyIds.length) {
    return NextResponse.json({ error: "One or more selected companies are unavailable." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const user = await getPrisma().user.create({
    data: {
      name: payload.name,
      email: payload.email,
      phone: payload.phone || null,
      passwordHash,
      roleId: role.id,
      createdBy: session.user.id,
      companies: {
        create: companyIds.map((companyId) => ({ companyId, createdBy: session.user.id })),
      },
    },
    include: { role: true, companies: { include: { company: true } } },
  });

  return NextResponse.json(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role.name,
      assignedTasks: 0,
      gapActions: 0,
      ownedGaps: 0,
      companies: user.companies.map((link) => ({ id: link.company.id, name: link.company.name, code: link.company.code })),
      assets: [],
      createdAt: user.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
