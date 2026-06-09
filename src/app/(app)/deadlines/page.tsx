import { format } from "date-fns";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getDeadlineMonitor, getProjectHealthSummary, type HealthLevel } from "@/lib/deadline-engine";
import { formatEnum } from "@/lib/utils";

const healthVariant: Record<HealthLevel, "success" | "warning" | "destructive"> = {
  green: "success",
  yellow: "warning",
  red: "destructive",
};

export default async function DeadlinesPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const companyId = await selectedCompanyId(searchParams);
  const [monitor, projects] = await Promise.all([getDeadlineMonitor(undefined, new Date(), companyId), getProjectHealthSummary(undefined, new Date(), companyId)]);
  const redProjects = projects.filter((project) => project.health === "red").length;
  const yellowProjects = projects.filter((project) => project.health === "yellow").length;
  const greenProjects = projects.filter((project) => project.health === "green").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Deadline Monitor</h1>
        <p className="text-sm text-muted-foreground">Automatic health tracking for overdue and upcoming work across projects.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Overdue Items" value={monitor.overdue.length} icon={AlertTriangle} variant="destructive" />
        <Metric title="Due Within 7 Days" value={monitor.upcoming.length} icon={Clock} variant="warning" />
        <Metric title="Projects At Risk" value={redProjects + yellowProjects} icon={CalendarClock} variant={redProjects ? "destructive" : "warning"} />
        <Metric title="Projects On Track" value={greenProjects} icon={CheckCircle2} variant="success" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Critical Deadlines</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitor.items.map((item) => (
                  <TableRow key={`${item.type}-${item.id}`}>
                    <TableCell>
                      <div className="min-w-48">
                        <div className="font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.type}</div>
                      </div>
                    </TableCell>
                    <TableCell>{item.projectName}</TableCell>
                    <TableCell>{item.ownerName}</TableCell>
                    <TableCell>
                      <div className="whitespace-nowrap">{format(item.dueDate, "MMM d, yyyy")}</div>
                      <div className="text-xs text-muted-foreground">{deadlineLabel(item.daysDelta)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={healthVariant[item.health]}>{formatEnum(item.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {monitor.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No overdue or upcoming deadlines.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Project Health Reasons</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {projects.map((project) => (
              <div key={project.projectId} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{project.projectName}</div>
                    <div className="truncate text-xs text-muted-foreground">{project.projectCode} / {project.managerName}</div>
                  </div>
                  <Badge className="shrink-0" variant={healthVariant[project.health]}>{project.health.toUpperCase()}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {project.reasons.map((reason) => (
                    <span key={reason} className="rounded-md bg-muted px-2 py-1">{reason}</span>
                  ))}
                </div>
              </div>
            ))}
            {projects.length === 0 && <p className="text-sm text-muted-foreground">No active projects to monitor.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Metric({ title, value, icon: Icon, variant }: { title: string; value: number; icon: typeof AlertTriangle; variant: "success" | "warning" | "destructive" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="truncate text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold leading-none">{value}</div>
        <Badge variant={variant}>{variant === "destructive" ? "RED" : variant === "warning" ? "YELLOW" : "GREEN"}</Badge>
      </CardContent>
    </Card>
  );
}

function deadlineLabel(daysDelta: number) {
  if (daysDelta < 0) return `${Math.abs(daysDelta)} day${Math.abs(daysDelta) === 1 ? "" : "s"} overdue`;
  if (daysDelta === 0) return "Due today";
  return `Due in ${daysDelta} day${daysDelta === 1 ? "" : "s"}`;
}
