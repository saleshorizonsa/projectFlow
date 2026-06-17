import { format, addYears, differenceInYears, isBefore } from "date-fns";
import { auth } from "@/lib/auth";
import {
  selectedCompanyId,
  type CompanySearchParams,
  projectCompanyWhere,
  assetCompanyWhere,
  userCompanyWhere,
} from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";
import type { CalendarEvent } from "@/lib/calendar-events";
import { CalendarShell } from "@/components/calendar/calendar-shell";

type PageProps = { searchParams: Promise<CompanySearchParams & { year?: string }> };

export default async function CalendarPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [session, companyId] = await Promise.all([auth(), selectedCompanyId(sp)]);
  const yearParam = parseInt(sp.year ?? String(new Date().getFullYear()), 10);
  const year = isNaN(yearParam) ? new Date().getFullYear() : yearParam;

  const prisma = getPrisma();
  const rangeStart = new Date(year, 0, 1);
  const rangeEnd   = new Date(year, 11, 31, 23, 59, 59);
  const now = new Date();

  const [maintenances, licenses, assets, milestones, tasks, gaps, resources, companies, projects] = await Promise.all([
    prisma.iTMaintenance.findMany({
      where: {
        scheduledAt: { gte: rangeStart, lte: rangeEnd },
        ...(companyId ? { asset: assetCompanyWhere(companyId) } : {}),
      },
      include: { asset: { include: { companies: { include: { company: true } } } }, responsible: true },
    }),
    prisma.iTLicense.findMany({
      where: { expiryDate: { gte: rangeStart, lte: rangeEnd } },
      include: { asset: true, employee: true },
    }),
    prisma.iTAsset.findMany({
      where: {
        status: { not: "RETIRED" },
        ...(companyId ? assetCompanyWhere(companyId) : {}),
      },
      include: { companies: { include: { company: true } } },
    }),
    prisma.milestone.findMany({
      where: {
        dueDate: { gte: rangeStart, lte: rangeEnd },
        ...(companyId ? { project: projectCompanyWhere(companyId) } : {}),
      },
      include: { project: true },
    }),
    prisma.task.findMany({
      where: {
        dueDate: { gte: rangeStart, lte: rangeEnd },
        ...(companyId
          ? {
              OR: [
                { project: projectCompanyWhere(companyId) },
                { taskType: "GENERAL" as const, assignee: userCompanyWhere(companyId) },
              ],
            }
          : {}),
      },
      include: { project: true, assignee: true },
    }),
    prisma.gap.findMany({
      where: {
        targetClosureDate: { gte: rangeStart, lte: rangeEnd },
        ...(companyId ? { project: projectCompanyWhere(companyId) } : {}),
      },
      include: { project: true, owner: true },
    }),
    prisma.resourceAllocation.findMany({
      where: {
        OR: [{ startAt: { lte: rangeEnd }, endAt: { gte: rangeStart } }],
        ...(companyId ? { user: userCompanyWhere(companyId) } : {}),
      },
      include: { user: true, project: true },
    }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { status: { not: "COMPLETED" } }, orderBy: { name: "asc" } }),
  ]);

  const events: CalendarEvent[] = [];

  // Maintenance
  for (const m of maintenances) {
    events.push({
      id: m.id,
      title: m.title,
      subtitle: m.asset.assetTag,
      type: "maintenance",
      date: format(m.scheduledAt, "yyyy-MM-dd"),
      timeLabel: format(m.scheduledAt, "HH:mm"),
      status: m.status,
      isOverdue: !["COMPLETED", "CANCELLED"].includes(m.status) && isBefore(m.scheduledAt, now),
      isComplete: m.status === "COMPLETED",
      href: "/it-maintenance/maintenance",
      companyId: m.asset.companies[0]?.companyId,
      assignedTo: m.responsible?.name ?? undefined,
    });
  }

  // Licenses
  for (const l of licenses) {
    events.push({
      id: l.id,
      title: `Renew: ${l.name}`,
      subtitle: l.vendor,
      type: "license",
      date: format(l.expiryDate, "yyyy-MM-dd"),
      status: "EXPIRING",
      isOverdue: isBefore(l.expiryDate, now),
      isComplete: false,
      href: "/it-maintenance/licenses/renewals",
    });
  }

  // Asset lifecycle reviews
  for (const a of assets) {
    const reviewDate = addYears(a.purchaseDate, a.lifecycleYears - 1);
    if (reviewDate >= rangeStart && reviewDate <= rangeEnd) {
      const age = differenceInYears(now, a.purchaseDate);
      events.push({
        id: `asset-review-${a.id}`,
        title: `Lifecycle Review: ${a.name}`,
        subtitle: `${a.assetTag} — ${age}yr / ${a.lifecycleYears}yr lifecycle`,
        type: "asset",
        date: format(reviewDate, "yyyy-MM-dd"),
        status: "REVIEW_DUE",
        isOverdue: isBefore(reviewDate, now),
        isComplete: a.status === "RETIRED",
        href: "/it-maintenance/assets",
        companyId: a.companies[0]?.companyId,
      });
    }
  }

  // Milestones
  for (const m of milestones) {
    events.push({
      id: m.id,
      title: m.name,
      subtitle: m.project.name,
      type: "milestone",
      date: format(m.dueDate, "yyyy-MM-dd"),
      status: m.status,
      isOverdue: m.status !== "COMPLETED" && isBefore(m.dueDate, now),
      isComplete: m.status === "COMPLETED",
      href: `/projects/${m.projectId}`,
    });
  }

  // Tasks
  for (const t of tasks) {
    events.push({
      id: t.id,
      title: t.title,
      subtitle: t.project?.name ?? "General",
      type: "task",
      date: format(t.dueDate, "yyyy-MM-dd"),
      status: t.status,
      severity: t.priority,
      isOverdue: t.status !== "COMPLETED" && isBefore(t.dueDate, now),
      isComplete: t.status === "COMPLETED",
      href: "/tasks",
      assignedTo: t.assignee.name,
    });
  }

  // Gaps
  for (const g of gaps) {
    events.push({
      id: g.id,
      title: g.title,
      subtitle: g.project.name,
      type: "gap",
      date: format(g.targetClosureDate, "yyyy-MM-dd"),
      status: g.status,
      severity: g.severity,
      isOverdue: g.status !== "CLOSED" && isBefore(g.targetClosureDate, now),
      isComplete: g.status === "CLOSED",
      href: "/gaps",
      assignedTo: g.owner.name,
    });
  }

  // Resource allocations (multi-day)
  for (const r of resources) {
    const start = r.startAt < rangeStart ? rangeStart : r.startAt;
    const end   = r.endAt   > rangeEnd   ? rangeEnd   : r.endAt;
    events.push({
      id: r.id,
      title: `${r.user.name} — ${r.allocationPercent}%`,
      subtitle: r.project?.name ?? r.title,
      type: "resource",
      date: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
      status: r.status,
      isOverdue: false,
      isComplete: r.status === "COMPLETED",
      href: "/resources",
      assignedTo: r.user.name,
    });
  }

  return (
    <CalendarShell
      events={events}
      year={year}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      currentUserId={session?.user.id ?? ""}
      currentUserRole={session?.user.role ?? "VIEWER"}
    />
  );
}
