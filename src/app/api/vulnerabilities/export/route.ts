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

  const vulns = await getPrisma().vulnerability.findMany({
    orderBy: { discoveredAt: "desc" },
    include: {
      assignedTo: { select: { name: true, email: true } },
      asset: { select: { assetTag: true, name: true } },
    },
    take: 5000,
  });

  const headers = [
    "Vuln ID", "Title", "CVE ID", "Severity", "CVSS Score", "Status",
    "Affected Component", "Source", "Remediation",
    "Asset Tag", "Asset Name", "Assigned To", "Assigned Email",
    "Discovered At", "Due Date", "Closed At", "Notes",
  ];

  const rows = vulns.map((v) => [
    esc(v.vulnId), esc(v.title), esc(v.cveId ?? ""), esc(v.severity), esc(v.cvssScore ?? ""), esc(v.status),
    esc(v.affectedComponent ?? ""), esc(v.source ?? ""), esc(v.remediation ?? ""),
    esc(v.asset?.assetTag ?? ""), esc(v.asset?.name ?? ""),
    esc(v.assignedTo?.name ?? ""), esc(v.assignedTo?.email ?? ""),
    esc(v.discoveredAt), esc(v.dueDate ?? ""), esc(v.closedAt ?? ""), esc(v.notes ?? ""),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\r\n");
  const date = new Date().toISOString().split("T")[0];
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vulnerabilities-${date}.csv"`,
    },
  });
}
