import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

function csvEscape(value: unknown): string {
  const raw = value instanceof Date ? value.toISOString() : String(value ?? "");
  const text = /^[=+\-@\t\r|%]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await getPrisma().auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))] as string[];
  const users = userIds.length > 0
    ? await getPrisma().user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const headers = ["Timestamp", "User", "Email", "Action", "Entity", "Entity ID", "IP Address", "Detail"];
  const rows = logs.map(l => {
    const u = l.userId ? userMap[l.userId] : null;
    return [
      csvEscape(l.createdAt.toISOString()),
      csvEscape(u?.name ?? "System"),
      csvEscape(u?.email ?? ""),
      csvEscape(l.action),
      csvEscape(l.entity ?? ""),
      csvEscape(l.entityId ?? ""),
      csvEscape(l.ip ?? ""),
      csvEscape(l.detail ? JSON.stringify(l.detail) : ""),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
