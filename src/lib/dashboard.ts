import { unstable_cache } from "next/cache";
import { addDays, endOfWeek, format, startOfDay, startOfWeek, subDays } from "date-fns";
import { getProjectHealthSummary } from "@/lib/deadline-engine";
import { projectCompanyWhere, relatedProjectCompanyWhere, userCompanyWhere } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";
import { getResourcePlanningData } from "@/lib/resource-planning";
import { formatEnum } from "@/lib/utils";

async function _getDashboardData(companyId?: string) {
  const prisma = getPrisma();
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const projectWhere = projectCompanyWhere(companyId);
  const relatedProjectWhere = relatedProjectCompanyWhere(companyId);
  const taskCompanyWhere = companyId
    ? { OR: [relatedProjectWhere, { taskType: "GENERAL" as const, assignee: userCompanyWhere(companyId) }] }
    : {};

  const [
    totalProjects,
    activeProjects,
    delayedProjects,
    completedProjects,
    openGaps,
    criticalGaps,
    upcomingDeadlines,
    tasksDueThisWeek,
    projects,
    gaps,
    tasks,
    milestones,
    projectProgress,
    taskCompletion,
    resourceTasks,
    gapTrendSource,
    projectHealth,
    resourcePlanning,
  ] = await Promise.all([
    prisma.project.count({ where: projectWhere }),
    prisma.project.count({ where: { ...projectWhere, status: { in: ["PLANNING", "PREPARATION", "IN_PROGRESS"] } } }),
    prisma.project.count({ where: { ...projectWhere, endDate: { lt: now }, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    prisma.project.count({ where: { ...projectWhere, status: "COMPLETED" } }),
    prisma.gap.count({ where: { ...relatedProjectWhere, status: { not: "CLOSED" } } }),
    prisma.gap.count({ where: { ...relatedProjectWhere, severity: "CRITICAL", status: { not: "CLOSED" } } }),
    prisma.milestone.count({ where: { ...relatedProjectWhere, dueDate: { gte: now, lte: addDays(now, 14) }, status: { not: "COMPLETED" } } }),
    prisma.task.count({ where: { ...taskCompanyWhere, dueDate: { gte: weekStart, lte: weekEnd }, status: { not: "COMPLETED" } } }),
    prisma.project.findMany({ where: projectWhere, include: { layers: true, manager: true }, orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.gap.findMany({ where: relatedProjectWhere, include: { project: true, owner: true }, orderBy: [{ severity: "desc" }, { targetClosureDate: "asc" }], take: 6 }),
    prisma.task.findMany({ where: taskCompanyWhere, include: { project: true, assignee: true }, orderBy: { dueDate: "asc" }, take: 8 }),
    prisma.milestone.findMany({ where: relatedProjectWhere, include: { project: true }, orderBy: { dueDate: "asc" }, take: 5 }),
    prisma.projectLayer.groupBy({ by: ["type"], where: relatedProjectWhere, _avg: { completion: true } }),
    prisma.task.groupBy({ by: ["status"], where: taskCompanyWhere, _count: { _all: true } }),
    prisma.task.findMany({
      where: taskCompanyWhere,
      select: {
        estimatedHours: true,
        actualHours: true,
        assignee: { select: { name: true } },
      },
    }),
    prisma.gap.findMany({
      select: { createdAt: true, status: true },
      where: { ...relatedProjectWhere, createdAt: { gte: subDays(startOfDay(now), 6) } },
      orderBy: { createdAt: "asc" },
    }),
    getProjectHealthSummary(prisma, now, companyId),
    getResourcePlanningData(companyId, prisma, now),
  ]);

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => startOfDay(subDays(now, 6 - index)));
  const gapTrend = lastSevenDays.map((date) => {
    const key = format(date, "MMM d");
    const gapsForDay = gapTrendSource.filter((gap) => format(gap.createdAt, "yyyy-MM-dd") === format(date, "yyyy-MM-dd"));
    return {
      name: key,
      opened: gapsForDay.filter((gap) => gap.status !== "CLOSED").length,
      closed: gapsForDay.filter((gap) => gap.status === "CLOSED").length,
    };
  });

  const resourceMap = new Map<string, { estimated: number; actual: number }>();
  for (const task of resourceTasks) {
    const name = task.assignee.name;
    const current = resourceMap.get(name) ?? { estimated: 0, actual: 0 };
    current.estimated += Number(task.estimatedHours);
    current.actual += Number(task.actualHours);
    resourceMap.set(name, current);
  }

  return {
    stats: { totalProjects, activeProjects, delayedProjects, completedProjects, openGaps, criticalGaps, upcomingDeadlines, tasksDueThisWeek },
    analytics: {
      projectProgress: projectProgress.map((item) => ({
        name: formatEnum(item.type),
        value: Math.round(item._avg.completion ?? 0),
      })),
      gapTrend,
      taskCompletion: taskCompletion.map((item) => ({
        name: formatEnum(item.status),
        value: item._count._all,
      })),
      resourceUtilization: resourcePlanning.utilization.map((resource) => ({
        name: resource.name,
        allocated: resource.allocatedHours,
        capacity: resource.capacityHours,
      })),
    },
    projects,
    projectHealth,
    gaps,
    tasks,
    milestones,
    resourcePlanning,
  };
}

export const getDashboardData = unstable_cache(
  _getDashboardData,
  ["dashboard-data"],
  { revalidate: 30, tags: ["dashboard"] },
);

async function _getSecurityPostureData(companyId?: string) {
  const prisma = getPrisma();
  // companyId is reserved for future multi-tenant scoping
  void companyId;
  try {
    const [
      openIncidents,
      criticalIncidents,
      criticalVulns,
      highVulns,
      highRisks,
      openPolicies,
    ] = await Promise.all([
      prisma.incident.count({ where: { status: { notIn: ["RECOVERED", "CLOSED"] } } }),
      prisma.incident.count({ where: { severity: "CRITICAL", status: { notIn: ["RECOVERED", "CLOSED"] } } }),
      prisma.vulnerability.count({ where: { severity: "CRITICAL", status: { notIn: ["REMEDIATED", "ACCEPTED_RISK", "FALSE_POSITIVE"] } } }).catch(() => 0),
      prisma.vulnerability.count({ where: { severity: "HIGH", status: { notIn: ["REMEDIATED", "ACCEPTED_RISK", "FALSE_POSITIVE"] } } }).catch(() => 0),
      prisma.risk.count({ where: { riskScore: { gte: 15 }, status: { notIn: ["CLOSED", "RESIDUAL"] } } }).catch(() => 0),
      prisma.policy.count({ where: { status: { in: ["DRAFT", "UNDER_REVIEW"] } } }).catch(() => 0),
    ]);

    // Score: start at 100, deduct points for issues
    let score = 100;
    score -= criticalIncidents * 10;
    score -= (openIncidents - criticalIncidents) * 3;
    score -= criticalVulns * 8;
    score -= highVulns * 3;
    score -= highRisks * 5;
    score -= openPolicies * 2;
    score = Math.max(0, Math.min(100, score));

    return { score, openIncidents, criticalIncidents, criticalVulns, highVulns, highRisks, openPolicies };
  } catch {
    return { score: null, openIncidents: 0, criticalIncidents: 0, criticalVulns: 0, highVulns: 0, highRisks: 0, openPolicies: 0 };
  }
}

export const getSecurityPostureData = unstable_cache(
  _getSecurityPostureData,
  ["security-posture"],
  { revalidate: 30, tags: ["dashboard"] },
);
