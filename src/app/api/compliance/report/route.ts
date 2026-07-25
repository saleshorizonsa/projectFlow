import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { buildComplianceReportPdf, type ComplianceReportData } from "@/lib/compliance-report-pdf";

const STATUS_LABELS: Record<string, string> = {
  COMPLIANT: "Compliant",
  PARTIALLY_COMPLIANT: "Partially Compliant",
  NON_COMPLIANT: "Non-Compliant",
  NOT_ASSESSED: "Not Assessed",
  NOT_APPLICABLE: "Not Applicable",
};

function fmtDate(d: Date | null): string {
  if (!d) return "-";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
}

export async function GET(request: Request) {
  await requireRole("VIEWER");
  const prisma = getPrisma();

  const url = new URL(request.url);
  const frameworkId = url.searchParams.get("frameworkId");
  const frameworkCode = url.searchParams.get("code");

  const framework = await prisma.complianceFramework.findFirst({
    where: frameworkId ? { id: frameworkId } : { code: frameworkCode ?? "SACS-210" },
    include: {
      domains: {
        orderBy: { order: "asc" },
        include: {
          controls: {
            orderBy: { controlId: "asc" },
            include: {
              responsible: { select: { name: true } },
              evidences: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!framework) {
    return new Response(JSON.stringify({ error: "Framework not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const companies = await prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const organization = companies.map((c) => c.name).join(" / ") || "Organization";

  const allControls = framework.domains.flatMap((d) => d.controls);
  const applicable = allControls.filter((c) => c.status !== "NOT_APPLICABLE");
  const compliant = applicable.filter((c) => c.status === "COMPLIANT").length;
  const overall = {
    compliant,
    total: applicable.length,
    pct: applicable.length === 0 ? 0 : Math.round((compliant / applicable.length) * 100),
  };

  const statusCounts = Object.entries(STATUS_LABELS)
    .map(([key, label]) => ({ label, count: allControls.filter((c) => c.status === key).length }))
    .filter((s) => s.count > 0);

  const domains = framework.domains.map((d) => {
    const app = d.controls.filter((c) => c.status !== "NOT_APPLICABLE");
    const comp = app.filter((c) => c.status === "COMPLIANT").length;
    return {
      code: d.code,
      name: d.name,
      score: { compliant: comp, total: app.length, pct: app.length === 0 ? 0 : Math.round((comp / app.length) * 100) },
      controls: d.controls.map((c) => ({
        controlId: c.controlId,
        title: c.title,
        status: c.status,
        responsible: c.responsible?.name ?? "Unassigned",
        evidenceCount: c.evidences.length,
        lastAssessed: fmtDate(c.lastAssessedAt),
      })),
    };
  });

  const gaps = allControls
    .filter((c) => c.status === "NON_COMPLIANT" || c.status === "PARTIALLY_COMPLIANT")
    .sort((a, b) => (a.status === "NON_COMPLIANT" ? -1 : 1) - (b.status === "NON_COMPLIANT" ? -1 : 1))
    .map((c) => ({
      controlId: c.controlId,
      title: c.title,
      status: c.status,
      notes: c.implementationNotes ?? "",
    }));

  const notAssessedCount = allControls.filter((c) => c.status === "NOT_ASSESSED").length;

  const data: ComplianceReportData = {
    organization,
    framework: { code: framework.code, name: framework.name, version: framework.version ?? "-" },
    generatedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
    overall,
    statusCounts,
    domains,
    gaps,
    notAssessedCount,
  };

  const pdf = buildComplianceReportPdf(data);
  const filename = `${framework.code}-compliance-report-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
