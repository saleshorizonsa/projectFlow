import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { milestoneUpdateSchema } from "@/lib/validators";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as string;
  if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = milestoneUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await getPrisma().milestone.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  const milestone = await getPrisma().milestone.update({ where: { id }, data: parsed.data });
  return NextResponse.json(milestone);
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as string;
  if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await getPrisma().milestone.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  await getPrisma().milestone.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
