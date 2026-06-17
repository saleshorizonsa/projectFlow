import { Users } from "lucide-react";
import { ResourceAllocationActions } from "@/components/resources/resource-allocation-actions";
import { ResourceAllocationForm } from "@/components/resources/resource-allocation-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { projectCompanyWhere, relatedAssetCompanyWhere, relatedProjectCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";
import { getResourcePlanningData, isOutsideOfficeTime, OFFICE_DAILY_HOURS, totalHoursBetween, workingHoursBetween } from "@/lib/resource-planning";
import { formatEnum } from "@/lib/utils";

export default async function ResourcesPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const companyId = await selectedCompanyId(searchParams);
  const prisma = getPrisma();
  const [planning, users, projects, tasks, maintenances] = await Promise.all([
    getResourcePlanningData(companyId, prisma),
    prisma.user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: projectCompanyWhere(companyId), orderBy: { name: "asc" } }),
    prisma.task.findMany({
      where: companyId
        ? { OR: [relatedProjectCompanyWhere(companyId), { taskType: "GENERAL", assignee: userCompanyWhere(companyId) }] }
        : {},
      include: { project: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.iTMaintenance.findMany({ where: relatedAssetCompanyWhere(companyId), include: { asset: true }, orderBy: { scheduledAt: "asc" } }),
  ]);
  const userOptions = users.map((user) => ({ id: user.id, name: user.name }));
  const projectOptions = projects.map((project) => ({ id: project.id, name: `${project.projectId} / ${project.name}` }));
  const taskOptions = tasks.map((task) => ({ id: task.id, name: task.project ? `${task.project.projectId} / ${task.title}` : `General / ${task.title}` }));
  const maintenanceOptions = maintenances.map((maintenance) => ({ id: maintenance.id, name: `${maintenance.maintenanceId} / ${maintenance.asset.assetTag}` }));

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-background to-background">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Resource Allocation</CardTitle>
            <CardDescription>Allocate team capacity to projects, tasks, and planned maintenance. After-hours work is allowed and highlighted for visibility.</CardDescription>
            </div>
            <Users className="h-5 w-5 shrink-0 text-primary" />
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Tasks Due" value={planning.requirements.tasksDue} label={`${planning.requirements.taskHours}h`} />
        <Metric title="Maintenance Due" value={planning.requirements.maintenances} label={`${planning.requirements.maintenanceHours}h`} />
        <Metric title="Projects Need Focus" value={planning.requirements.projectsAtRisk} label="30 days" />
        <Metric title="Suggested Team Size" value={planning.requirements.suggestedPeople} label={`${OFFICE_DAILY_HOURS}h/day`} />
      </section>

      {session?.user.role !== "VIEWER" && (
        <ResourceAllocationForm
          users={userOptions}
          projects={projectOptions}
          tasks={taskOptions}
          maintenances={maintenanceOptions}
        />
      )}

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Resource Utilization</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {planning.utilization.map((resource) => (
              <div key={resource.userId} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{resource.name}</div>
                    <div className="text-xs text-muted-foreground">{formatEnum(resource.role)} / {resource.allocatedHours}h allocated / {resource.officeHours}h inside office</div>
                  </div>
                  <Badge variant={resource.status === "overloaded" ? "destructive" : resource.status === "busy" ? "warning" : "success"}>{resource.status}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={Math.min(resource.utilization, 100)} />
                  <span className="w-12 text-right text-xs text-muted-foreground">{resource.utilization}%</span>
                </div>
                {resource.conflicts.length > 0 && <div className="mt-2 text-xs text-destructive">{resource.conflicts.slice(0, 2).join(" / ")}</div>}
                {resource.outsideOffice > 0 && <div className="mt-1 text-xs font-medium text-yellow-700 dark:text-yellow-300">{resource.outsideOffice} after-hours allocation(s) recorded.</div>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Suggestions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {planning.suggestions.map((suggestion) => <div key={suggestion} className="rounded-md border p-3 text-sm">{suggestion}</div>)}
            {planning.suggestions.length === 0 && <p className="text-sm text-muted-foreground">No allocation suggestions right now.</p>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Daily Team Requirement</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Workload</TableHead><TableHead>Team Required</TableHead></TableRow></TableHeader>
              <TableBody>
                {planning.dailyDemand.map((day) => (
                  <TableRow key={day.date}>
                    <TableCell>{day.label}</TableCell>
                    <TableCell>{day.totalHours}h <span className="text-xs text-muted-foreground">tasks {day.taskHours}h / maintenance {day.maintenanceHours}h / allocation {day.allocationHours}h</span></TableCell>
                    <TableCell><Badge variant={day.requiredPeople > users.length ? "destructive" : day.requiredPeople > Math.max(users.length - 1, 1) ? "warning" : "secondary"}>{day.requiredPeople} people</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Allocation Register</CardTitle></CardHeader>
          <CardContent className="max-h-[440px] overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Resource</TableHead><TableHead>Work</TableHead><TableHead>Time</TableHead><TableHead>Status</TableHead>{session?.user.role !== "VIEWER" && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
              <TableBody>
                {planning.allocations.map((allocation) => {
                  const afterHours = isOutsideOfficeTime(allocation.startAt, allocation.endAt);
                  return (
                    <TableRow key={allocation.id} className={afterHours ? "bg-yellow-50/80 dark:bg-yellow-950/20" : undefined}>
                      <TableCell>
                        <div className="font-medium">{allocation.user.name}</div>
                        {afterHours && <Badge className="mt-1" variant="warning">After hours</Badge>}
                      </TableCell>
                      <TableCell><div className="font-medium">{allocation.title}</div><div className="text-xs text-muted-foreground">{allocation.project?.name ?? allocation.task?.title ?? allocation.maintenance?.title ?? "General"}</div></TableCell>
                      <TableCell>
                        <div>{allocation.startAt.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">to {allocation.endAt.toLocaleString()}</div>
                        <div className={afterHours ? "text-xs font-medium text-yellow-700 dark:text-yellow-300" : "text-xs text-muted-foreground"}>
                          {totalHoursBetween(allocation.startAt, allocation.endAt)}h allocated / {workingHoursBetween(allocation.startAt, allocation.endAt)}h inside office
                        </div>
                      </TableCell>
                      <TableCell><Badge variant={allocation.status === "CONFIRMED" ? "success" : "secondary"}>{formatEnum(allocation.status)}</Badge></TableCell>
                      {session?.user.role !== "VIEWER" && (
                        <TableCell className="text-right">
                          <ResourceAllocationActions
                            allocation={{
                              id: allocation.id,
                              userId: allocation.userId,
                              title: allocation.title,
                              projectId: allocation.projectId,
                              taskId: allocation.taskId,
                              maintenanceId: allocation.maintenanceId,
                              startAt: allocation.startAt.toISOString(),
                              endAt: allocation.endAt.toISOString(),
                              allocationPercent: allocation.allocationPercent,
                              status: allocation.status,
                              notes: allocation.notes,
                            }}
                            users={userOptions}
                            projects={projectOptions}
                            tasks={taskOptions}
                            maintenances={maintenanceOptions}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {planning.allocations.length === 0 && <TableRow><TableCell colSpan={session?.user.role !== "VIEWER" ? 5 : 4} className="text-center text-muted-foreground">No planned resource allocations.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Metric({ title, value, label }: { title: string; value: number; label: string }) {
  return (
    <Card>
      <CardHeader className="space-y-0 pb-2"><CardTitle className="truncate text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold leading-none">{value}</div>
        <Badge variant="outline">{label}</Badge>
      </CardContent>
    </Card>
  );
}
