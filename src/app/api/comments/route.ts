import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { commentSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const taskId = searchParams.get("taskId") ?? undefined;
  const gapId = searchParams.get("gapId") ?? undefined;
  const supportTicketId = searchParams.get("supportTicketId") ?? undefined;

  if (!projectId && !taskId && !gapId && !supportTicketId) {
    return NextResponse.json({ error: "Provide at least one entity filter" }, { status: 400 });
  }

  const comments = await getPrisma().comment.findMany({
    where: { projectId, taskId, gapId, supportTicketId },
    include: { author: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  if (!data.projectId && !data.taskId && !data.gapId && !data.supportTicketId) {
    return NextResponse.json({ error: "Provide at least one entity reference" }, { status: 400 });
  }

  const comment = await getPrisma().comment.create({
    data: {
      body: data.body,
      authorId: session.user.id,
      projectId: data.projectId,
      taskId: data.taskId,
      gapId: data.gapId,
      supportTicketId: data.supportTicketId,
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}
