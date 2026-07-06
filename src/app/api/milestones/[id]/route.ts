import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  completion: z.coerce.number().int().min(0).max(100).optional(),
  status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED", "DELAYED"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const milestone = await getPrisma().milestone.update({
    where: { id },
    data: { ...parsed.data, updatedBy: session.user.id },
  });
  return NextResponse.json(milestone);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "PROJECT_MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await getPrisma().milestone.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}