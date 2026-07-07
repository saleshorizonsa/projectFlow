import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { milestoneSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company") ?? undefined;

  const projects = await getPrisma().project.findMany({
    where: companyId ? { companies: { some: { companyId } } } : {},
    select: {
      id: true,
      name: true,
      status: true,
      milestones: {
        orderBy: { dueDate: "asc" },
        select: { id: true, name: true, description: true, dueDate: true, completion: true, status: true, projectId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as string;
  if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = milestoneSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { projectId, ...data } = parsed.data;

  const project = await getPrisma().project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const milestone = await getPrisma().milestone.create({
    data: { ...data, projectId },
  });

  return NextResponse.json(milestone, { status: 201 });
}
