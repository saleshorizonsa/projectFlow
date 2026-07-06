import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FolderKanban, Gauge, Shield, TriangleAlert, Users } from "lucide-react";
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts";
import { DashboardSection, DashboardCustomizeButton } from "@/components/dashboard/dashboard-customize";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getDashboardData, getSecurityPostureData } from "@/lib/dashboard";
import { formatEnum, trafficLight } from "@/lib/utils";

const statIcons = [FolderKanban, Gauge, AlertTriangle, CheckCircle2, TriangleAlert, AlertTriangle, CalendarClock, ClipboardList];

const statColors = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",   // Total Projects
  "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",            // Active Projects
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",             // Delayed Projects
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", // Completed Projects
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",         // Open Gaps
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",     // Critical Gaps
  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",     // Upcoming Deadlines
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",     // Tasks Due This Week
];

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const companyId = await selectedCompanyId(searchParams);
  const [data, secPosture] = await Promise.all([
    getDashboardData(companyId),
    getSecurityPostureData(companyId),
  ]);
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

  const score = secPosture.score;
  const scoreColor = (score === null ? "secondary" : score >= 80 ? "success" : score >= 60 ? "warning" : "destructive") as "secondary" | "success" | "warning" | "destructive";
  const scoreLabel = score === null ? "Unknown" : score >= 80 ? "Good" : score >= 60 ? "Fair" : "At Risk";

  return (
    <div className="space-y-4">
      <section className="grid gap-3 xl:grid-cols-[1.15fr_2fr]">
        <Card className="overflow-hidden border-primary/20 bg-primary text-primary-foreground">
          <CardContent className="flex h-full flex-col justify-between gap-5 p-5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium opacity-85">Command Center</div>
                <DashboardCustomizeButton />
              </div>
              <div className="mt-2 text-3xl font-semibold leading-none">HorizonMiyaar</div>
              <p className="mt-3 max-w-md text-sm leading-6 opacity-85">Live execution control for projects, gaps, deadlines, resources, and accountability.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <HealthPill label="On Track" value={greenProjects} />
              <HealthPill label="Risk" value={yellowProjects} />
              <HealthPill label="Delayed" value={redProjects} />
            </div>
          </CardContent>
        </Card>

        <DashboardSection id="stats">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {statEntries.map(([label, value], index) => {
            const Icon = statIcons[index];
            const color = statColors[index];
            return (
              <Card key={label} className="min-w-0">
                <CardContent className="flex min-h-20 items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
                    <div className="mt-2 text-2xl font-semibold leading-none">{value}</div>
                  </div>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        </DashboardSection>
      </section>

      <DashboardSection id="security">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="sm:col-span-2 overflow-hidden">
          <CardContent className="flex items-center gap-6 p-5 bg-gradient-to-r from-violet-50 to-transparent dark:from-violet-950/25">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-violet-200 bg-violet-100 dark:border-violet-800 dark:bg-violet-900/40">
              <Shield className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Security Posture</div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold">{score ?? "—"}</span>
                <span className="text-sm text-muted-foreground">/100</span>
                <Badge variant={scoreColor}>{scoreLabel}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Based on open incidents, vulnerabilities, and risk posture</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Open Incidents</p>
            <p className="mt-1 text-2xl font-bold">{secPosture.openIncidents}</p>
            {secPosture.criticalIncidents > 0 && <p className="mt-0.5 text-xs text-destructive">{secPosture.criticalIncidents} critical</p>}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Critical Vulns</p>
            <p className="mt-1 text-2xl font-bold">{secPosture.criticalVulns}</p>
            {secPosture.highVulns > 0 && <p className="mt-0.5 text-xs text-orange-600 dark:text-orange-400">{secPosture.highVulns} high</p>}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">High Risks</p>
            <p className="mt-1 text-2xl font-bold">{secPosture.highRisks}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-400">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Policies Pending</p>
            <p className="mt-1 text-2xl font-bold">{secPosture.openPolicies}</p>
          </CardContent>
        </Card>
      </section>
      </DashboardSection>

      <DashboardSection id="analytics">
        <AnalyticsCharts {...data.analytics} />
      </DashboardSection>

      <DashboardSection id="resources">
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-teal-50 to-transparent pb-3 dark:from-teal-950/25">
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
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-indigo-50 to-transparent pb-3 dark:from-indigo-950/25">
            <CardTitle>Team Requirement</CardTitle>
            <Users className="h-4 w-4 text-indigo-500" />
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
      </DashboardSection>

      <DashboardSection id="health">
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-emerald-50 to-transparent pb-3 dark:from-emerald-950/25">
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
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-amber-50 to-transparent pb-3 dark:from-amber-950/25">
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
      </DashboardSection>
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
