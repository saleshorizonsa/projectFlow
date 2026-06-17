import { addDays, differenceInMinutes, endOfDay, format, startOfDay } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import { assetCompanyWhere, projectCompanyWhere, relatedAssetCompanyWhere, relatedProjectCompanyWhere, userCompanyWhere } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export const OFFICE_START_HOUR = 8;
export const OFFICE_END_HOUR = 17;
export const OFFICE_DAILY_HOURS = OFFICE_END_HOUR - OFFICE_START_HOUR;

type AllocationInput = {
  id: string;
  userId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  allocationPercent: number;
  status: string;
  user: { id: string; name: string };
  project?: { name: string } | null;
  task?: { title: string } | null;
  maintenance?: { title: string } | null;
};

export function isOfficeDay(date: Date) {
  const day = date.getDay();
  return day >= 0 && day <= 4;
}

export function workingHoursBetween(startAt: Date, endAt: Date) {
  if (endAt <= startAt) return 0;
  let totalMinutes = 0;
  const cursor = new Date(startOfDay(startAt));
  const finalDay = startOfDay(endAt);

  while (cursor <= finalDay) {
    if (isOfficeDay(cursor)) {
      const dayStart = new Date(cursor);
      dayStart.setHours(OFFICE_START_HOUR, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(OFFICE_END_HOUR, 0, 0, 0);
      const windowStart = startAt > dayStart ? startAt : dayStart;
      const windowEnd = endAt < dayEnd ? endAt : dayEnd;
      if (windowEnd > windowStart) totalMinutes += differenceInMinutes(windowEnd, windowStart);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return Math.round((totalMinutes / 60) * 10) / 10;
}

export function totalHoursBetween(startAt: Date, endAt: Date) {
  if (endAt <= startAt) return 0;
  return Math.round((differenceInMinutes(endAt, startAt) / 60) * 10) / 10;
}

export function isOutsideOfficeTime(startAt: Date, endAt: Date) {
  return workingHoursBetween(startAt, endAt) < totalHoursBetween(startAt, endAt);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export async function getResourcePlanningData(companyId?: string, prisma: PrismaClient = getPrisma(), now = new Date()) {
  const horizon = addDays(now, 14);
  const projectWhere = projectCompanyWhere(companyId);
  const relatedProjectWhere = relatedProjectCompanyWhere(companyId);
  const relatedAssetWhere = relatedAssetCompanyWhere(companyId);
  const taskCompanyWhere = companyId
    ? { OR: [relatedProjectWhere, { taskType: "GENERAL" as const, assignee: userCompanyWhere(companyId) }] }
    : {};
  const [users, allocations, tasksDue, maintenances, projectsAtRisk] = await Promise.all([
    prisma.user.findMany({
      where: companyId ? { OR: [{ companies: { some: { companyId } } }, { role: { name: "ADMIN" } }] } : {},
      include: { role: true },
      orderBy: { name: "asc" },
    }),
    prisma.resourceAllocation.findMany({
      where: {
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        startAt: { lte: horizon },
        endAt: { gte: startOfDay(now) },
        OR: [
          { project: projectWhere },
          { task: taskCompanyWhere },
          { maintenance: relatedAssetWhere },
        ],
      },
      include: { user: true, project: true, task: true, maintenance: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.task.findMany({
      where: { ...taskCompanyWhere, dueDate: { gte: startOfDay(now), lte: horizon }, status: { not: "COMPLETED" } },
      include: { project: true, assignee: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.iTMaintenance.findMany({
      where: { ...relatedAssetWhere, scheduledAt: { gte: startOfDay(now), lte: horizon }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      include: { responsible: true, asset: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.project.findMany({
      where: { ...projectWhere, status: { in: ["PLANNING", "PREPARATION", "IN_PROGRESS"] }, endDate: { lte: addDays(now, 30) } },
      include: { manager: true, tasks: true, gaps: true },
      orderBy: { endDate: "asc" },
    }),
  ]);

  const utilization = users.map((user) => {
    const mine = allocations.filter((allocation) => allocation.userId === user.id);
    const allocatedHours = mine.reduce((sum, allocation) => sum + totalHoursBetween(allocation.startAt, allocation.endAt) * (allocation.allocationPercent / 100), 0);
    const officeHours = mine.reduce((sum, allocation) => sum + workingHoursBetween(allocation.startAt, allocation.endAt) * (allocation.allocationPercent / 100), 0);
    const conflicts = mine.flatMap((allocation, index) => mine.slice(index + 1).filter((other) => overlaps(allocation.startAt, allocation.endAt, other.startAt, other.endAt)).map((other) => `${allocation.title} overlaps ${other.title}`));
    const outsideOffice = mine.filter((allocation) => isOutsideOfficeTime(allocation.startAt, allocation.endAt)).length;
    const capacity = OFFICE_DAILY_HOURS * 10;
    return {
      userId: user.id,
      name: user.name,
      role: user.role.name,
      allocatedHours: Math.round(allocatedHours * 10) / 10,
      officeHours: Math.round(officeHours * 10) / 10,
      capacityHours: capacity,
      utilization: Math.min(160, Math.round((allocatedHours / capacity) * 100)),
      status: conflicts.length || allocatedHours > capacity ? "overloaded" as const : allocatedHours > 0 || outsideOffice ? "busy" as const : "available" as const,
      conflicts,
      outsideOffice,
    };
  });

  const dailyDemand = Array.from({ length: 10 }, (_, index) => {
    const date = addDays(startOfDay(now), index);
    if (!isOfficeDay(date)) return null;
    const dayKey = format(date, "yyyy-MM-dd");
    const taskHours = tasksDue
      .filter((task) => format(task.dueDate, "yyyy-MM-dd") === dayKey)
      .reduce((sum, task) => sum + Number(task.estimatedHours), 0);
    const maintenanceHours = maintenances
      .filter((maintenance) => format(maintenance.scheduledAt, "yyyy-MM-dd") === dayKey)
      .reduce((sum, maintenance) => sum + maintenance.durationMinutes / 60, 0);
    const allocationHours = allocations
      .filter((allocation) => allocation.startAt <= endOfDay(date) && allocation.endAt >= date)
      .reduce((sum, allocation) => {
        const windowStart = allocation.startAt > date ? allocation.startAt : date;
        const windowEnd = allocation.endAt < endOfDay(date) ? allocation.endAt : endOfDay(date);
        return sum + totalHoursBetween(windowStart, windowEnd) * (allocation.allocationPercent / 100);
      }, 0);
    const totalHours = Math.round((taskHours + maintenanceHours + allocationHours) * 10) / 10;
    return {
      date: date.toISOString(),
      label: format(date, "MMM d"),
      taskHours: Math.round(taskHours * 10) / 10,
      maintenanceHours: Math.round(maintenanceHours * 10) / 10,
      allocationHours: Math.round(allocationHours * 10) / 10,
      totalHours,
      requiredPeople: Math.ceil(totalHours / OFFICE_DAILY_HOURS),
    };
  }).filter(Boolean) as { date: string; label: string; taskHours: number; maintenanceHours: number; allocationHours: number; totalHours: number; requiredPeople: number }[];

  const suggestions = [
    ...utilization.filter((item) => item.status === "overloaded").map((item) => `${item.name} is overloaded or has overlapping allocations.`),
    ...utilization.filter((item) => item.status === "available").slice(0, 3).map((item) => `${item.name} has available capacity for new work.`),
    ...projectsAtRisk.slice(0, 3).map((project) => `${project.name} ends within 30 days and may need focused team coverage.`),
  ];

  return {
    allocations,
    utilization,
    dailyDemand,
    suggestions,
    requirements: {
      tasksDue: tasksDue.length,
      taskHours: Math.round(tasksDue.reduce((sum, task) => sum + Number(task.estimatedHours), 0) * 10) / 10,
      maintenances: maintenances.length,
      maintenanceHours: Math.round(maintenances.reduce((sum, maintenance) => sum + maintenance.durationMinutes / 60, 0) * 10) / 10,
      projectsAtRisk: projectsAtRisk.length,
      suggestedPeople: Math.max(...dailyDemand.map((day) => day.requiredPeople), 0),
    },
  };
}

export async function findAllocationConflicts(userId: string, startAt: Date, endAt: Date, excludeId?: string, prisma: PrismaClient = getPrisma()) {
  const existing = await prisma.resourceAllocation.findMany({
    where: {
      userId,
      id: excludeId ? { not: excludeId } : undefined,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    orderBy: { startAt: "asc" },
  });
  return existing.map((allocation) => allocation.title);
}
