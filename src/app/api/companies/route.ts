import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { companySchema } from "@/lib/validators";

export async function GET() {
  await requireRole("VIEWER");
  const companies = await getPrisma().company.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(companies);
}

export async function POST(request: Request) {
  const session = await requireRole("ADMIN");
  const parsed = companySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid company data", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const company = await getPrisma().company.create({
    data: {
      ...payload,
      code: payload.code.toUpperCase(),
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(company, { status: 201 });
}
