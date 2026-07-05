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

  const employees = await getPrisma().employee.findMany({
    orderBy: { name: "asc" },
    include: {
      companies: { include: { company: { select: { name: true, code: true } } } },
      assets: { select: { assetTag: true } },
    },
    take: 5000,
  });

  const headers = [
    "Employee ID", "Name", "Email", "Phone", "Department", "Job Title",
    "Location", "Status", "Companies", "Assets Assigned",
    "IP Address", "VPN User ID",
  ];

  const rows = employees.map((e) => [
    esc(e.employeeId), esc(e.name), esc(e.email ?? ""), esc(e.phone ?? ""),
    esc(e.department), esc(e.jobTitle), esc(e.location ?? ""), esc(e.status),
    esc(e.companies.map((c) => c.company.code).join("; ")),
    esc(e.assets.map((a) => a.assetTag).join("; ")),
    esc(e.ipAddress ?? ""), esc(e.vpnUserId ?? ""),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\r\n");
  const date = new Date().toISOString().split("T")[0];
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="employees-${date}.csv"`,
    },
  });
}
