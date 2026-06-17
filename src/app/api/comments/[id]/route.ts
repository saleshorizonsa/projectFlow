import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const comment = await getPrisma().comment.findUnique({ where: { id } });
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  const isAuthor = comment.authorId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isAuthor && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await getPrisma().comment.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
