import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const entity = searchParams.get("entity");
  const userId = searchParams.get("userId");

  const logs = await getPrisma().auditLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(entity ? { entity } : {}),
      ...(userId ? { userId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Fetch user names for log entries
  const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))] as string[];
  const users = userIds.length > 0
    ? await getPrisma().user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  return NextResponse.json(logs.map(l => ({ ...l, user: l.userId ? userMap[l.userId] ?? null : null })));
}
