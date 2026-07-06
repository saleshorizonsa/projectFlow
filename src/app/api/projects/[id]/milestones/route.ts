import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(1).optional().default(""),
  dueDate: z.coerce.date(),
  completion: z.coerce.number().int().min(0).max(100).optional().default(0),
  status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED", "DELAYED"]).optional().default("UPCOMING"),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await getPrisma().project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const milestones = await getPrisma().milestone.findMany({
    where: { projectId: id },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json(milestones);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const project = await getPrisma().project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const milestone = await getPrisma().milestone.create({
    data: {
      ...parsed.data,
      description: parsed.data.description ?? "",
      projectId: id,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    },
  });
  return NextResponse.json(milestone, { status: 201 });
}
