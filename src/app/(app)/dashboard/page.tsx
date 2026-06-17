import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FolderKanban, Gauge, TriangleAlert, Users } from "lucide-react";
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
  const redProjects = data.projectHealth.filter((project) => project.health === "red").length;
  const yellowProjects = data.projectHealth.filter((project) => project.health === "yellow").length;
  const greenProjects = data.projectHealth.filter((project) => project.health === "green").length;
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
    <div className="space-y-4">
      <section className="grid gap-3 xl:grid-cols-[1.15fr_2fr]">
        <Card className="overflow-hidden border-primary/20 bg-primary text-primary-foreground">
          <CardContent className="flex h-full flex-col justify-between gap-5 p-5">
            <div>
              <div className="text-sm font-medium opacity-85">Command Center</div>
              <div className="mt-2 text-3xl font-semibold leading-none">ProjectFlow</div>
              <p className="mt-3 max-w-md text-sm leading-6 opacity-85">Live execution control for projects, gaps, deadlines, resources, and accountability.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <HealthPill label="On Track" value={greenProjects} />
              <HealthPill label="Risk" value={yellowProjects} />
              <HealthPill label="Delayed" value={redProjects} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {statEntries.map(([label, value], index) => {
          const Icon = statIcons[index];
          return (
            <Card key={label} className="min-w-0">
              <CardContent className="flex min-h-20 items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
                  <div className="mt-2 text-2xl font-semibold leading-none">{value}</div>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      </section>

      <AnalyticsCharts {...data.analytics} />

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle>Resource Allocation</CardTitle>
            <Badge variant="outline">{data.resourcePlanning.requirements.suggestedPeople} people needed</Badge>
          </CardHeader>
          <CardContent className="grid max-h-[420px] gap-3 overflow-y-auto pr-2 md:grid-cols-2">
            {data.resourcePlanning.utilization.map((resource) => (
              <div key={resource.userId} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{resource.name}</div>
                    <div className="text-xs text-muted-foreground">{resource.allocatedHours}h allocated / {resource.officeHours}h inside office / {resource.capacityHours}h capacity</div>
                  </div>
                  <Badge variant={resource.status === "overloaded" ? "destructive" : resource.status === "busy" ? "warning" : "success"}>{resource.status}</Badge>
                </div>
                <Progress className="mt-3 h-2" value={Math.min(resource.utilization, 100)} />
                {resource.outsideOffice > 0 && <div className="mt-2 text-xs font-medium text-yellow-700 dark:text-yellow-300">{resource.outsideOffice} after-hours allocation(s)</div>}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle>Team Requirement</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="max-h-[320px] space-y-2 overflow-y-auto pr-2">
            {data.resourcePlanning.dailyDemand.slice(0, 7).map((day) => (
              <div key={day.date} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">{day.label}</div>
                  <div className="text-xs text-muted-foreground">{day.totalHours}h planned work</div>
                </div>
                <Badge variant="secondary">{day.requiredPeople} people</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle>Active Project Health</CardTitle>
            <Badge variant="outline">{data.projectHealth.length} active</Badge>
          </CardHeader>
          <CardContent className="max-h-[360px] space-y-3 overflow-y-auto pr-3">
            {data.projectHealth.map((project) => {
              const badgeVariant = project.health === "red" ? "destructive" : project.health === "yellow" ? "warning" : "success";
              return (
                <div key={project.projectId} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{project.projectName}</div>
                      <div className="truncate text-xs text-muted-foreground">{project.client} / {project.managerName}</div>
                    </div>
                    <Badge className="shrink-0" variant={badgeVariant}>{project.health.toUpperCase()}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress className="h-2" value={project.completion} />
                    <span className="w-10 text-right text-xs font-medium text-muted-foreground">{project.completion}%</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
                    {project.reasons.slice(0, 3).map((reason) => (
                      <span key={reason} className="rounded-md bg-muted px-2 py-1">{reason}</span>
                    ))}
                  </div>
                </div>
              );
            })}
            {data.projectHealth.length === 0 && <p className="text-sm text-muted-foreground">No active projects to monitor.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle>Critical Deadline Watch</CardTitle>
            <Badge variant="outline">{data.gaps.length}</Badge>
          </CardHeader>
          <CardContent className="max-h-[360px] space-y-2 overflow-y-auto pr-3">
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
            {data.gaps.length === 0 && <p className="text-sm text-muted-foreground">No critical deadline items.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function HealthPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/10 px-2 py-3">
      <div className="text-xl font-semibold leading-none">{value}</div>
      <div className="mt-1 truncate text-[11px] opacity-85">{label}</div>
    </div>
  );
}
