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

  const risks = await getPrisma().risk.findMany({
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { name: true, email: true } } },
    take: 5000,
  });

  const headers = [
    "Risk ID", "Title", "Category", "Status", "Treatment",
    "Likelihood", "Impact", "Risk Score",
    "Residual Likelihood", "Residual Impact", "Residual Score",
    "Owner", "Owner Email", "Due Date", "Closed At", "Notes",
  ];

  const rows = risks.map((r) => [
    esc(r.riskId), esc(r.title), esc(r.category), esc(r.status), esc(r.treatment),
    esc(r.likelihood), esc(r.impact), esc(r.riskScore),
    esc(r.residualLikelihood ?? ""), esc(r.residualImpact ?? ""), esc(r.residualScore ?? ""),
    esc(r.owner.name), esc(r.owner.email),
    esc(r.dueDate ?? ""), esc(r.closedAt ?? ""), esc(r.notes ?? ""),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\r\n");
  const date = new Date().toISOString().split("T")[0];
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="risk-register-${date}.csv"`,
    },
  });
}
