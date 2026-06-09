import { differenceInCalendarDays, startOfDay } from "date-fns";
import { NotificationType, type PrismaClient } from "@prisma/client";
import { projectCompanyWhere, relatedProjectCompanyWhere } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export type EscalationLevel = "LEVEL_1" | "LEVEL_2" | "LEVEL_3";
export type EscalationStatus = "DUE" | "ESCALATED";

export type EscalationRule = {
  id: string;
  trigger: string;
  level: EscalationLevel;
  threshold: string;
  notify: string;
};

export type EscalationItem = {
  id: string;
  ruleId: string;
  level: EscalationLevel;
  status: EscalationStatus;
  module: "Gap" | "Task" | "Milestone" | "Project";
  title: string;
  projectName: string;
  ownerName: string;
  managerName: string;
  daysOverdue: number;
  reason: string;
  notifyUserIds: string[];
  notificationType: NotificationType;
};

export const escalationRules: EscalationRule[] = [
  {
    id: "critical-gap-overdue-1d",
    trigger: "Critical gap target closure missed",
    level: "LEVEL_3",
    threshold: "Overdue by 1+ day",
    notify: "Gap owner, project manager, admins",
  },
  {
    id: "high-gap-overdue-3d",
    trigger: "High severity gap target closure missed",
    level: "LEVEL_2",
    threshold: "Overdue by 3+ days",
    notify: "Gap owner, project manager",
  },
  {
    id: "blocked-task-2d",
    trigger: "Task remains blocked",
    level: "LEVEL_2",
    threshold: "Blocked for 2+ days",
    notify: "Assignee, project manager",
  },
  {
    id: "milestone-missed",
    trigger: "Milestone due date missed",
    level: "LEVEL_2",
    threshold: "Overdue by 1+ day",
    notify: "Project manager",
  },
  {
    id: "project-end-date-passed",
    trigger: "Project end date passed before completion",
    level: "LEVEL_3",
    threshold: "Overdue by 1+ day",
    notify: "Project manager, admins",
  },
];

function daysOverdue(date: Date, now: Date) {
  return differenceInCalendarDays(startOfDay(now), startOfDay(date));
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function escalationStatus(days: number): EscalationStatus {
  return days > 0 ? "ESCALATED" : "DUE";
}

export async function getEscalationMatrix(prisma: PrismaClient = getPrisma(), now = new Date(), companyId?: string) {
  const projectWhere = projectCompanyWhere(companyId);
  const relatedProjectWhere = relatedProjectCompanyWhere(companyId);
  const [admins, gaps, tasks, milestones, projects] = await Promise.all([
    prisma.user.findMany({ where: { role: { name: "ADMIN" } }, select: { id: true } }),
    prisma.gap.findMany({
      where: {
        ...relatedProjectWhere,
        status: { not: "CLOSED" },
        severity: { in: ["HIGH", "CRITICAL"] },
        targetClosureDate: { lt: now },
      },
      include: { owner: true, project: { include: { manager: true } } },
      orderBy: { targetClosureDate: "asc" },
    }),
    prisma.task.findMany({
      where: { ...relatedProjectWhere, status: "BLOCKED" },
      include: { assignee: true, project: { include: { manager: true } } },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.milestone.findMany({
      where: {
        ...relatedProjectWhere,
        status: { not: "COMPLETED" },
        dueDate: { lt: now },
      },
      include: { project: { include: { manager: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.project.findMany({
      where: {
        ...projectWhere,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        endDate: { lt: now },
      },
      include: { manager: true },
      orderBy: { endDate: "asc" },
    }),
  ]);
  const adminIds = admins.map((admin) => admin.id);

  const gapItems = gaps
    .map((gap): EscalationItem | null => {
      const overdue = daysOverdue(gap.targetClosureDate, now);
      if (gap.severity === "CRITICAL" && overdue >= 1) {
        return {
          id: gap.id,
          ruleId: "critical-gap-overdue-1d",
          level: "LEVEL_3",
          status: escalationStatus(overdue),
          module: "Gap",
          title: `${gap.gapId}: ${gap.title}`,
          projectName: gap.project.name,
          ownerName: gap.owner.name,
          managerName: gap.project.manager.name,
          daysOverdue: overdue,
          reason: `Critical gap is ${overdue} day${overdue === 1 ? "" : "s"} overdue.`,
          notifyUserIds: uniq([gap.ownerId, gap.project.managerId, ...adminIds]),
          notificationType: NotificationType.GAP_OVERDUE,
        };
      }
      if (gap.severity === "HIGH" && overdue >= 3) {
        return {
          id: gap.id,
          ruleId: "high-gap-overdue-3d",
          level: "LEVEL_2",
          status: escalationStatus(overdue),
          module: "Gap",
          title: `${gap.gapId}: ${gap.title}`,
          projectName: gap.project.name,
          ownerName: gap.owner.name,
          managerName: gap.project.manager.name,
          daysOverdue: overdue,
          reason: `High severity gap is ${overdue} days overdue.`,
          notifyUserIds: uniq([gap.ownerId, gap.project.managerId]),
          notificationType: NotificationType.GAP_OVERDUE,
        };
      }
      return null;
    })
    .filter(Boolean) as EscalationItem[];

  const taskItems = tasks
    .map((task): EscalationItem | null => {
      const blockedDays = daysOverdue(task.updatedAt, now);
      if (blockedDays < 2) return null;
      return {
        id: task.id,
        ruleId: "blocked-task-2d",
        level: "LEVEL_2",
        status: "ESCALATED",
        module: "Task",
        title: task.title,
        projectName: task.project.name,
        ownerName: task.assignee.name,
        managerName: task.project.manager.name,
        daysOverdue: blockedDays,
        reason: `Task has been blocked for ${blockedDays} days.`,
        notifyUserIds: uniq([task.assigneeId, task.project.managerId]),
        notificationType: NotificationType.TASK_OVERDUE,
      };
    })
    .filter(Boolean) as EscalationItem[];

  const milestoneItems = milestones.map((milestone): EscalationItem => {
    const overdue = daysOverdue(milestone.dueDate, now);
    return {
      id: milestone.id,
      ruleId: "milestone-missed",
      level: "LEVEL_2",
      status: escalationStatus(overdue),
      module: "Milestone",
      title: milestone.name,
      projectName: milestone.project.name,
      ownerName: milestone.project.manager.name,
      managerName: milestone.project.manager.name,
      daysOverdue: overdue,
      reason: `Milestone is ${overdue} day${overdue === 1 ? "" : "s"} overdue.`,
      notifyUserIds: [milestone.project.managerId],
      notificationType: NotificationType.MILESTONE_MISSED,
    };
  });

  const projectItems = projects.map((project): EscalationItem => {
    const overdue = daysOverdue(project.endDate, now);
    return {
      id: project.id,
      ruleId: "project-end-date-passed",
      level: "LEVEL_3",
      status: escalationStatus(overdue),
      module: "Project",
      title: `${project.projectId}: ${project.name}`,
      projectName: project.name,
      ownerName: project.manager.name,
      managerName: project.manager.name,
      daysOverdue: overdue,
      reason: `Project planned end date passed ${overdue} day${overdue === 1 ? "" : "s"} ago.`,
      notifyUserIds: uniq([project.managerId, ...adminIds]),
      notificationType: NotificationType.PROJECT_DELAYED,
    };
  });

  const items = [...gapItems, ...taskItems, ...milestoneItems, ...projectItems].sort((left, right) => {
    const levelRank = { LEVEL_3: 0, LEVEL_2: 1, LEVEL_1: 2 };
    return levelRank[left.level] - levelRank[right.level] || right.daysOverdue - left.daysOverdue;
  });

  return {
    rules: escalationRules,
    items,
    level3: items.filter((item) => item.level === "LEVEL_3"),
    level2: items.filter((item) => item.level === "LEVEL_2"),
    level1: items.filter((item) => item.level === "LEVEL_1"),
  };
}

export async function syncEscalationNotifications(prisma: PrismaClient = getPrisma(), now = new Date()) {
  const matrix = await getEscalationMatrix(prisma, now);
  let created = 0;

  for (const item of matrix.items) {
    for (const userId of item.notifyUserIds) {
      const title = `Escalation ${item.level.replace("_", " ")}: ${item.title}`;
      const message = `${item.projectName}: ${item.reason} Owner: ${item.ownerName}. Project manager: ${item.managerName}.`;
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type: item.notificationType,
          title,
          message,
          readAt: null,
        },
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            userId,
            type: item.notificationType,
            title,
            message,
          },
        });
        created += 1;
      }
    }
  }

  return created;
}
