import { addDays, differenceInCalendarDays, endOfDay, startOfDay } from "date-fns";
import { NotificationType, type PrismaClient, type ProjectStatus } from "@prisma/client";
import { projectCompanyWhere, relatedProjectCompanyWhere } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export type HealthLevel = "green" | "yellow" | "red";

export type ProjectHealth = {
  projectId: string;
  projectCode: string;
  projectName: string;
  client: string;
  managerId: string;
  managerName: string;
  status: ProjectStatus;
  completion: number;
  health: HealthLevel;
  reasons: string[];
  overdueTasks: number;
  overdueGaps: number;
  overdueActions: number;
  missedMilestones: number;
  criticalGaps: number;
  daysRemaining: number;
};

export type DeadlineItem = {
  id: string;
  type: "Task" | "Gap" | "Gap Action" | "Milestone" | "Project";
  title: string;
  projectName: string;
  ownerName: string;
  dueDate: Date;
  status: string;
  health: HealthLevel;
  daysDelta: number;
};

type NotificationCandidate = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
};

const completedProjectStatuses: ProjectStatus[] = ["COMPLETED", "CANCELLED"];

function daysUntil(date: Date, now: Date) {
  return differenceInCalendarDays(startOfDay(date), startOfDay(now));
}

function deadlineHealth(dueDate: Date, status: string, now: Date): HealthLevel {
  if (["COMPLETED", "CLOSED", "CANCELLED"].includes(status)) return "green";
  const days = daysUntil(dueDate, now);
  if (days < 0) return "red";
  if (days <= 7) return "yellow";
  return "green";
}

function healthFromRisk(hasRed: boolean, hasYellow: boolean): HealthLevel {
  if (hasRed) return "red";
  if (hasYellow) return "yellow";
  return "green";
}

function plural(count: number, label: string) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

export async function getProjectHealthSummary(prisma: PrismaClient = getPrisma(), now = new Date(), companyId?: string): Promise<ProjectHealth[]> {
  const projectWhere = projectCompanyWhere(companyId);
  const projects = await prisma.project.findMany({
    where: { ...projectWhere, status: { notIn: completedProjectStatuses } },
    include: {
      manager: true,
      currentState: true,
      layers: true,
      tasks: true,
      milestones: true,
      gaps: { include: { actions: true } },
    },
    orderBy: { endDate: "asc" },
  });

  return projects.map((project) => {
    const overdueTasks = project.tasks.filter((task) => deadlineHealth(task.dueDate, task.status, now) === "red").length;
    const overdueGaps = project.gaps.filter((gap) => deadlineHealth(gap.targetClosureDate, gap.status, now) === "red").length;
    const overdueActions = project.gaps.reduce(
      (sum, gap) => sum + gap.actions.filter((action) => deadlineHealth(action.dueDate, action.status, now) === "red").length,
      0,
    );
    const missedMilestones = project.milestones.filter((milestone) => deadlineHealth(milestone.dueDate, milestone.status, now) === "red").length;
    const criticalGaps = project.gaps.filter((gap) => gap.severity === "CRITICAL" && gap.status !== "CLOSED").length;
    const daysRemaining = daysUntil(project.endDate, now);
    const completion = Math.round(project.layers.reduce((sum, layer) => sum + layer.completion, 0) / Math.max(project.layers.length, 1));
    const currentStateRiskText = `${project.currentState?.risks ?? ""} ${project.currentState?.painPoints ?? ""} ${project.currentState?.constraints ?? ""}`.toLowerCase();
    const currentStateRisk = Boolean(project.currentState && /(risk|delay|blocked|constraint|issue|gap|manual|shortage|missing|dependency)/.test(currentStateRiskText));
    const lowCurrentStateConfidence = Boolean(project.currentState && project.currentState.confidenceLevel <= 2);

    const reasons = [
      overdueTasks ? plural(overdueTasks, "overdue task") : null,
      overdueGaps ? plural(overdueGaps, "overdue gap") : null,
      overdueActions ? plural(overdueActions, "overdue action") : null,
      missedMilestones ? plural(missedMilestones, "missed milestone") : null,
      criticalGaps ? plural(criticalGaps, "critical open gap") : null,
      currentStateRisk ? "current state assessment has risks or constraints" : null,
      lowCurrentStateConfidence ? "current state confidence is low" : null,
      !project.currentState ? "current state assessment missing" : null,
      daysRemaining < 0 ? "project end date passed" : null,
      daysRemaining >= 0 && daysRemaining <= 7 ? "project end date within 7 days" : null,
    ].filter(Boolean) as string[];

    const hasRed = overdueTasks > 0 || overdueGaps > 0 || overdueActions > 0 || missedMilestones > 0 || daysRemaining < 0;
    const hasYellow = criticalGaps > 0 || currentStateRisk || lowCurrentStateConfidence || !project.currentState || (daysRemaining >= 0 && daysRemaining <= 7);

    return {
      projectId: project.id,
      projectCode: project.projectId,
      projectName: project.name,
      client: project.client,
      managerId: project.managerId,
      managerName: project.manager.name,
      status: project.status,
      completion,
      health: healthFromRisk(hasRed, hasYellow),
      reasons: reasons.length ? reasons : ["No active deadline risk"],
      overdueTasks,
      overdueGaps,
      overdueActions,
      missedMilestones,
      criticalGaps,
      daysRemaining,
    };
  });
}

export async function getDeadlineMonitor(prisma: PrismaClient = getPrisma(), now = new Date(), companyId?: string) {
  const soon = endOfDay(addDays(now, 14));
  const projectWhere = projectCompanyWhere(companyId);
  const relatedProjectWhere = relatedProjectCompanyWhere(companyId);
  const [tasks, gaps, actions, milestones, projects] = await Promise.all([
    prisma.task.findMany({
      where: { ...relatedProjectWhere, dueDate: { lte: soon }, status: { not: "COMPLETED" } },
      include: { project: true, assignee: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.gap.findMany({
      where: { ...relatedProjectWhere, targetClosureDate: { lte: soon }, status: { not: "CLOSED" } },
      include: { project: true, owner: true },
      orderBy: { targetClosureDate: "asc" },
    }),
    prisma.gapAction.findMany({
      where: { dueDate: { lte: soon }, status: { not: "COMPLETED" }, gap: relatedProjectWhere },
      include: { gap: { include: { project: true } }, responsiblePerson: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.milestone.findMany({
      where: { ...relatedProjectWhere, dueDate: { lte: soon }, status: { not: "COMPLETED" } },
      include: { project: { include: { manager: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.project.findMany({
      where: { ...projectWhere, endDate: { lte: soon }, status: { notIn: completedProjectStatuses } },
      include: { manager: true },
      orderBy: { endDate: "asc" },
    }),
  ]);

  const items: DeadlineItem[] = [
    ...tasks.map((task) => ({
      id: task.id,
      type: "Task" as const,
      title: task.title,
      projectName: task.project.name,
      ownerName: task.assignee.name,
      dueDate: task.dueDate,
      status: task.status,
      health: deadlineHealth(task.dueDate, task.status, now),
      daysDelta: daysUntil(task.dueDate, now),
    })),
    ...gaps.map((gap) => ({
      id: gap.id,
      type: "Gap" as const,
      title: gap.title,
      projectName: gap.project.name,
      ownerName: gap.owner.name,
      dueDate: gap.targetClosureDate,
      status: gap.status,
      health: deadlineHealth(gap.targetClosureDate, gap.status, now),
      daysDelta: daysUntil(gap.targetClosureDate, now),
    })),
    ...actions.map((action) => ({
      id: action.id,
      type: "Gap Action" as const,
      title: action.correctiveAction,
      projectName: action.gap.project.name,
      ownerName: action.responsiblePerson.name,
      dueDate: action.dueDate,
      status: action.status,
      health: deadlineHealth(action.dueDate, action.status, now),
      daysDelta: daysUntil(action.dueDate, now),
    })),
    ...milestones.map((milestone) => ({
      id: milestone.id,
      type: "Milestone" as const,
      title: milestone.name,
      projectName: milestone.project.name,
      ownerName: milestone.project.manager.name,
      dueDate: milestone.dueDate,
      status: milestone.status,
      health: deadlineHealth(milestone.dueDate, milestone.status, now),
      daysDelta: daysUntil(milestone.dueDate, now),
    })),
    ...projects.map((project) => ({
      id: project.id,
      type: "Project" as const,
      title: project.name,
      projectName: project.name,
      ownerName: project.manager.name,
      dueDate: project.endDate,
      status: project.status,
      health: deadlineHealth(project.endDate, project.status, now),
      daysDelta: daysUntil(project.endDate, now),
    })),
  ].sort((left, right) => {
    const healthRank = { red: 0, yellow: 1, green: 2 };
    return healthRank[left.health] - healthRank[right.health] || left.dueDate.getTime() - right.dueDate.getTime();
  });

  return {
    items,
    overdue: items.filter((item) => item.health === "red"),
    upcoming: items.filter((item) => item.health === "yellow"),
  };
}

export async function syncDeadlineNotificationsForUser(userId: string, prisma: PrismaClient = getPrisma(), now = new Date()) {
  const [tasks, gaps, actions, milestones, projects] = await Promise.all([
    prisma.task.findMany({ where: { assigneeId: userId, dueDate: { lt: now }, status: { not: "COMPLETED" } }, include: { project: true } }),
    prisma.gap.findMany({ where: { ownerId: userId, targetClosureDate: { lt: now }, status: { not: "CLOSED" } }, include: { project: true } }),
    prisma.gapAction.findMany({ where: { responsibleId: userId, dueDate: { lt: now }, status: { not: "COMPLETED" } }, include: { gap: { include: { project: true } } } }),
    prisma.milestone.findMany({ where: { dueDate: { lt: now }, status: { not: "COMPLETED" }, project: { managerId: userId } }, include: { project: true } }),
    prisma.project.findMany({ where: { managerId: userId, endDate: { lt: now }, status: { notIn: completedProjectStatuses } } }),
  ]);

  const candidates: NotificationCandidate[] = [
    ...tasks.map((task) => ({
      userId,
      type: NotificationType.TASK_OVERDUE,
      title: `Task overdue: ${task.title}`,
      message: `${task.project.name} has an overdue task due ${task.dueDate.toLocaleDateString()}.`,
    })),
    ...gaps.map((gap) => ({
      userId,
      type: NotificationType.GAP_OVERDUE,
      title: `Gap overdue: ${gap.title}`,
      message: `${gap.project.name} has an overdue ${gap.severity.toLowerCase()} gap target closure date.`,
    })),
    ...actions.map((action) => ({
      userId,
      type: NotificationType.GAP_OVERDUE,
      title: `Gap action overdue: ${action.actionId}`,
      message: `${action.gap.project.name} has an overdue corrective action: ${action.correctiveAction}.`,
    })),
    ...milestones.map((milestone) => ({
      userId,
      type: NotificationType.MILESTONE_MISSED,
      title: `Milestone missed: ${milestone.name}`,
      message: `${milestone.project.name} missed a milestone due ${milestone.dueDate.toLocaleDateString()}.`,
    })),
    ...projects.map((project) => ({
      userId,
      type: NotificationType.PROJECT_DELAYED,
      title: `Project delayed: ${project.name}`,
      message: `${project.projectId} passed its planned end date and is still ${project.status.toLowerCase().replaceAll("_", " ")}.`,
    })),
  ];

  for (const candidate of candidates) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: candidate.userId,
        type: candidate.type,
        title: candidate.title,
        message: candidate.message,
        readAt: null,
      },
    });

    if (!existing) {
      await prisma.notification.create({ data: candidate });
    }
  }

  return candidates.length;
}
