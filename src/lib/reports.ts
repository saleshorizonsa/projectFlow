import { format } from "date-fns";
import { getDashboardData } from "@/lib/dashboard";
import { projectCompanyWhere, relatedProjectCompanyWhere } from "@/lib/company-filter";
import { getDeadlineMonitor, getProjectHealthSummary } from "@/lib/deadline-engine";
import { getPrisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/utils";

export const reportDefinitions = [
  {
    type: "project-status",
    title: "Project Status Report",
    description: "Portfolio status, manager accountability, budget, progress, and automatic health.",
  },
  {
    type: "gap",
    title: "Gap Report",
    description: "Gap register with severity, calculated impact, owner, root cause, and closure target.",
  },
  {
    type: "deadline",
    title: "Deadline Report",
    description: "Overdue and upcoming tasks, gaps, actions, milestones, and project end dates.",
  },
  {
    type: "resource",
    title: "Resource Report",
    description: "Assigned work, estimated hours, actual hours, open tasks, and overdue ownership.",
  },
  {
    type: "executive-summary",
    title: "Executive Summary",
    description: "High-level KPIs, project health mix, gaps, deadlines, and action counts.",
  },
] as const;

export type ReportType = (typeof reportDefinitions)[number]["type"];

type CsvValue = string | number | Date | null | undefined;

function dateValue(value: Date | string | null | undefined) {
  if (!value) return "";
  return format(new Date(value), "yyyy-MM-dd");
}

function csvEscape(value: CsvValue) {
  const raw = value instanceof Date ? dateValue(value) : String(value ?? "");
  // Prevent CSV formula injection (OWASP): prefix formula triggers with apostrophe
  const text = /^[=+\-@\t\r|%]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(headers: string[], rows: CsvValue[][]) {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

export function reportFileName(type: ReportType) {
  return `${type}-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
}

export function isReportType(value: string): value is ReportType {
  return reportDefinitions.some((report) => report.type === value);
}

export async function buildReportCsv(type: ReportType, companyId?: string) {
  if (type === "project-status") return buildProjectStatusReport(companyId);
  if (type === "gap") return buildGapReport(companyId);
  if (type === "deadline") return buildDeadlineReport(companyId);
  if (type === "resource") return buildResourceReport(companyId);
  return buildExecutiveSummaryReport(companyId);
}

async function buildProjectStatusReport(companyId?: string) {
  const prisma = getPrisma();
  const [projects, health] = await Promise.all([
    prisma.project.findMany({
      where: projectCompanyWhere(companyId),
      include: { manager: true, layers: true, tasks: true, gaps: true, milestones: true },
      orderBy: { updatedAt: "desc" },
    }),
    getProjectHealthSummary(prisma, new Date(), companyId),
  ]);
  const healthByProject = new Map(health.map((item) => [item.projectId, item]));

  return toCsv(
    ["Project ID", "Project Name", "Client", "Manager", "Status", "Priority", "Start Date", "End Date", "Budget", "Completion %", "Health", "Health Reasons", "Tasks", "Open Gaps", "Milestones"],
    projects.map((project) => {
      const projectHealth = healthByProject.get(project.id);
      const completion = projectHealth?.completion ?? Math.round(project.layers.reduce((sum, layer) => sum + layer.completion, 0) / Math.max(project.layers.length, 1));
      return [
        project.projectId,
        project.name,
        project.client,
        project.manager.name,
        formatEnum(project.status),
        formatEnum(project.priority),
        dateValue(project.startDate),
        dateValue(project.endDate),
        Number(project.budget),
        completion,
        projectHealth?.health.toUpperCase() ?? "GREEN",
        projectHealth?.reasons.join("; ") ?? "No active deadline risk",
        project.tasks.length,
        project.gaps.filter((gap) => gap.status !== "CLOSED").length,
        project.milestones.length,
      ];
    }),
  );
}

async function buildGapReport(companyId?: string) {
  const gaps = await getPrisma().gap.findMany({
    where: relatedProjectCompanyWhere(companyId),
    include: { project: true, layer: true, subLayer: true, owner: true, actions: true },
    orderBy: [{ severity: "desc" }, { targetClosureDate: "asc" }],
  });

  return toCsv(
    ["Gap ID", "Title", "Project", "Layer", "Sub Layer", "Severity", "Calculated Impact", "Root Cause", "Owner", "Created Date", "Target Closure", "Status", "Action Plans", "Action Progress %"],
    gaps.map((gap) => {
      const actionProgress = gap.actions.length ? Math.round(gap.actions.reduce((sum, action) => sum + action.progress, 0) / gap.actions.length) : 0;
      return [
        gap.gapId,
        gap.title,
        gap.project.name,
        gap.layer.name,
        gap.subLayer?.name,
        formatEnum(gap.severity),
        gap.impact,
        gap.rootCause,
        gap.owner.name,
        dateValue(gap.createdAt),
        dateValue(gap.targetClosureDate),
        formatEnum(gap.status),
        gap.actions.length,
        actionProgress,
      ];
    }),
  );
}

async function buildDeadlineReport(companyId?: string) {
  const monitor = await getDeadlineMonitor(undefined, new Date(), companyId);

  return toCsv(
    ["Type", "Title", "Project", "Owner", "Due Date", "Deadline State", "Days Delta", "Status"],
    monitor.items.map((item) => [
      item.type,
      item.title,
      item.projectName,
      item.ownerName,
      dateValue(item.dueDate),
      item.health.toUpperCase(),
      item.daysDelta,
      formatEnum(item.status),
    ]),
  );
}

async function buildResourceReport(companyId?: string) {
  const users = await getPrisma().user.findMany({
    include: {
      role: true,
      assignedTasks: { where: relatedProjectCompanyWhere(companyId) },
      gapActions: { where: { gap: relatedProjectCompanyWhere(companyId) } },
      ownedGaps: { where: relatedProjectCompanyWhere(companyId) },
    },
    orderBy: { name: "asc" },
  });
  const now = new Date();

  return toCsv(
    ["Team Member", "Role", "Assigned Tasks", "Open Tasks", "Overdue Tasks", "Estimated Hours", "Actual Hours", "Owned Open Gaps", "Assigned Gap Actions", "Overdue Gap Actions"],
    users.map((user) => {
      const openTasks = user.assignedTasks.filter((task) => task.status !== "COMPLETED");
      const overdueTasks = openTasks.filter((task) => task.dueDate < now);
      const openGaps = user.ownedGaps.filter((gap) => gap.status !== "CLOSED");
      const openActions = user.gapActions.filter((action) => action.status !== "COMPLETED");
      const overdueActions = openActions.filter((action) => action.dueDate < now);
      return [
        user.name,
        formatEnum(user.role.name),
        user.assignedTasks.length,
        openTasks.length,
        overdueTasks.length,
        user.assignedTasks.reduce((sum, task) => sum + Number(task.estimatedHours), 0),
        user.assignedTasks.reduce((sum, task) => sum + Number(task.actualHours), 0),
        openGaps.length,
        openActions.length,
        overdueActions.length,
      ];
    }),
  );
}

async function buildExecutiveSummaryReport(companyId?: string) {
  const [dashboard, health, monitor] = await Promise.all([getDashboardData(companyId), getProjectHealthSummary(undefined, new Date(), companyId), getDeadlineMonitor(undefined, new Date(), companyId)]);
  const rows: CsvValue[][] = [
    ["Total Projects", dashboard.stats.totalProjects],
    ["Active Projects", dashboard.stats.activeProjects],
    ["Delayed Projects", dashboard.stats.delayedProjects],
    ["Completed Projects", dashboard.stats.completedProjects],
    ["Open Gaps", dashboard.stats.openGaps],
    ["Critical Gaps", dashboard.stats.criticalGaps],
    ["Upcoming Deadlines", dashboard.stats.upcomingDeadlines],
    ["Tasks Due This Week", dashboard.stats.tasksDueThisWeek],
    ["Red Projects", health.filter((project) => project.health === "red").length],
    ["Yellow Projects", health.filter((project) => project.health === "yellow").length],
    ["Green Projects", health.filter((project) => project.health === "green").length],
    ["Overdue Deadline Items", monitor.overdue.length],
    ["Due Within 7 Days", monitor.upcoming.length],
  ];

  return toCsv(["Metric", "Value"], rows);
}
