import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FolderKanban, Gauge, TriangleAlert } from "lucide-react";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getDashboardData } from "@/lib/dashboard";
import { formatEnum, trafficLight } from "@/lib/utils";

const statIcons = [FolderKanban, Gauge, AlertTriangle, CheckCircle2, TriangleAlert, AlertTriangle, CalendarClock, ClipboardList];

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const companyId = await selectedCompanyId(searchParams);
  const data = await getDashboardData(companyId);
  const statEntries = [
    ["Total Projects", data.stats.totalProjects],
    ["Active Projects", data.stats.activeProjects],
    ["Delayed Projects", data.stats.delayedProjects],
    ["Completed Projects", data.stats.completedProjects],
    ["Open Gaps", data.stats.openGaps],
    ["Critical Gaps", data.stats.criticalGaps],
    ["Upcoming Deadlines", data.stats.upcomingDeadlines],
    ["Tasks Due This Week", data.stats.tasksDueThisWeek],
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statEntries.map(([label, value], index) => {
          const Icon = statIcons[index];
          return (
            <Card key={label} className="min-w-0">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="min-w-0 truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</CardTitle>
                <Icon className="h-4 w-4 shrink-0 text-primary" />
              </CardHeader>
              <CardContent><div className="text-2xl font-semibold leading-none sm:text-3xl">{value}</div></CardContent>
            </Card>
          );
        })}
      </section>

      <AnalyticsCharts {...data.analytics} />

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Active Project Health</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {data.projectHealth.map((project) => {
              const badgeVariant = project.health === "red" ? "destructive" : project.health === "yellow" ? "warning" : "success";
              return (
                <div key={project.projectId} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{project.projectName}</div>
                      <div className="truncate text-xs text-muted-foreground">{project.client} / {project.managerName}</div>
                    </div>
                    <Badge className="shrink-0" variant={badgeVariant}>{project.health.toUpperCase()}</Badge>
                  </div>
                  <Progress value={project.completion} />
                  <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                    {project.reasons.slice(0, 3).map((reason) => (
                      <span key={reason} className="rounded-md bg-muted px-2 py-1">{reason}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Critical Deadline Watch</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.gaps.map((gap) => {
              const light = trafficLight(gap.targetClosureDate, gap.status);
              return (
                <div key={gap.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{gap.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{gap.project.name}</div>
                  </div>
                  <Badge className="shrink-0" variant={light === "red" ? "destructive" : light === "yellow" ? "warning" : "success"}>{gap.severity}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
