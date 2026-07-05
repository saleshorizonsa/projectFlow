import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

function esc(v: unknown): string {
  const raw = v instanceof Date ? v.toISOString() : String(v ?? "");
  const s = /^[=+\-@\t\r|%]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const tickets = await getPrisma().supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { name: true, code: true } },
      employee: { select: { name: true, employeeId: true } },
      assignedTo: { select: { name: true, email: true } },
      asset: { select: { assetTag: true, name: true } },
    },
    take: 5000,
  });

  const headers = [
    "Ticket #", "Title", "Category", "Priority", "Status", "Source",
    "Company", "Requester", "Employee ID",
    "Assigned To", "Assigned Email",
    "Asset", "SLA Breached",
    "First Response Due", "Resolve Due", "Responded At", "Resolved At",
    "Created At",
  ];

  const rows = tickets.map((t) => [
    esc(t.ticketNo), esc(t.title), esc(t.category), esc(t.priority), esc(t.status), esc(t.source),
    esc(t.company.name),
    esc(t.employee?.name ?? t.requesterName ?? ""),
    esc(t.employee?.employeeId ?? ""),
    esc(t.assignedTo?.name ?? ""), esc(t.assignedTo?.email ?? ""),
    esc(t.asset ? `${t.asset.assetTag} / ${t.asset.name}` : ""),
    esc(t.slaBreached ? "Yes" : "No"),
    esc(t.firstResponseDueAt ?? ""), esc(t.resolveDueAt ?? ""),
    esc(t.respondedAt ?? ""), esc(t.resolvedAt ?? ""),
    esc(t.createdAt),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\r\n");
  const date = new Date().toISOString().split("T")[0];
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="support-tickets-${date}.csv"`,
    },
  });
}
