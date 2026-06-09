import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getDeadlineMonitor, getProjectHealthSummary } from "@/lib/deadline-engine";
import { getDashboardData } from "@/lib/dashboard";
import { reportDefinitions } from "@/lib/reports";

export default async function ReportsPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const companyId = await selectedCompanyId(searchParams);
  const [data, health, monitor] = await Promise.all([getDashboardData(companyId), getProjectHealthSummary(undefined, new Date(), companyId), getDeadlineMonitor(undefined, new Date(), companyId)]);
  const reportQuery = companyId ? `?company=${companyId}` : "";
  const redProjects = health.filter((project) => project.health === "red").length;
  const atRiskProjects = health.filter((project) => project.health !== "green").length;
  const reportMeta = {
    "project-status": `${data.stats.totalProjects} projects / ${atRiskProjects} at risk`,
    gap: `${data.stats.openGaps} open gaps / ${data.stats.criticalGaps} critical`,
    deadline: `${monitor.overdue.length} overdue / ${monitor.upcoming.length} upcoming`,
    resource: `${data.analytics.resourceUtilization.length} active resources`,
    "executive-summary": `${redProjects} red projects / ${data.stats.delayedProjects} delayed`,
  } satisfies Record<(typeof reportDefinitions)[number]["type"], string>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>Generate Excel-ready CSV reports from current project execution, gap, resource, and deadline data.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportDefinitions.map((report) => (
            <Card key={report.type} className="min-w-0 border-dashed">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-sm">{report.title}</CardTitle>
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
                </div>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Badge className="w-fit" variant="secondary">{reportMeta[report.type]}</Badge>
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/reports/${report.type}${reportQuery}`}>
                    <Download className="h-4 w-4" />
                    CSV
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
