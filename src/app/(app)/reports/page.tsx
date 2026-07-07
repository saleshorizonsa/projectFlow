import { format, subMonths, startOfMonth, differenceInYears } from "date-fns";
import { getPrisma } from "@/lib/prisma";
import { selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { formatEnum } from "@/lib/utils";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";

// ---------- local types (server-only) ----------

type ReportData = {
  tickets: {
    totalOpen: number;
    slaBreached: number;
    byCategory: { name: string; value: number }[];
    byStatus: { name: string; value: number }[];
    monthlyVolume: { name: string; value: number }[];
  };
  gaps: {
    bySeverity: { name: string; value: number }[];
    byStatus: { name: string; value: number }[];
  };
  assets: {
    byStatus: { name: string; value: number }[];
    lifecycleRisk: { name: string; value: number }[];
  };
  projects: {
    list: { name: string; value: number; status: string }[];
    byStatus: { name: string; value: number }[];
  };
  milestones: {
    byStatus: { name: string; value: number }[];
  };
  companies: { id: string; name: string }[];
  selectedCompanyId: string;
  periodMonths: number;
};

type ReportsSearchParams = CompanySearchParams & { period?: string };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<ReportsSearchParams>;
}) {
  const prisma = getPrisma();
  const sp = await searchParams;
  const companyId = await selectedCompanyId(sp);

  const now = new Date();
  const periodMonths = Number(sp?.period ?? "12");
  const validPeriods = [1, 3, 6, 12];
  const months = validPeriods.includes(periodMonths) ? periodMonths : 12;
  const twelveMonthsAgo = startOfMonth(subMonths(now, months - 1));

  // Closed statuses for tickets
  const closedStatuses = ["RESOLVED" as const, "CLOSED" as const];

  // Company filter helpers
  const ticketWhere = companyId ? { companyId } : {};
  const assetWhere = companyId ? { companies: { some: { companyId } } } : {};
  const projectWhere = companyId ? { companies: { some: { companyId } } } : {};
  const gapWhere = companyId ? { project: { companies: { some: { companyId } } } } : {};
  const milestoneWhere = companyId ? { project: { companies: { some: { companyId } } } } : {};

  const [
    ticketsTotalOpen,
    ticketsSlaBreached,
    ticketsByCategory,
    ticketsByStatus,
    ticketsMonthlyRaw,
    gapsBySeverity,
    gapsByStatus,
    assetsRaw,
    projectsRaw,
    milestonesByStatus,
    companies,
  ] = await Promise.all([
    // totalOpen
    prisma.supportTicket.count({
      where: {
        ...ticketWhere,
        status: { notIn: closedStatuses },
      },
    }),

    // slaBreached
    prisma.supportTicket.count({
      where: {
        ...ticketWhere,
        slaBreached: true,
        status: { notIn: closedStatuses },
      },
    }),

    // byCategory
    prisma.supportTicket.groupBy({
      by: ["category"],
      where: ticketWhere,
      _count: { _all: true },
      orderBy: { category: "asc" },
    }),

    // byStatus
    prisma.supportTicket.groupBy({
      by: ["status"],
      where: ticketWhere,
      _count: { _all: true },
    }),

    // monthly volume (last 12 months)
    prisma.supportTicket.findMany({
      where: {
        ...ticketWhere,
        createdAt: { gte: twelveMonthsAgo },
      },
      select: { createdAt: true },
    }),

    // gaps bySeverity
    prisma.gap.groupBy({
      by: ["severity"],
      where: gapWhere,
      _count: { _all: true },
    }),

    // gaps byStatus
    prisma.gap.groupBy({
      by: ["status"],
      where: gapWhere,
      _count: { _all: true },
    }),

    // assets (for status + lifecycle)
    prisma.iTAsset.findMany({
      where: assetWhere,
      select: {
        status: true,
        purchaseDate: true,
        lifecycleYears: true,
      },
    }),

    // projects with layers
    prisma.project.findMany({
      where: projectWhere,
      select: {
        name: true,
        status: true,
        layers: { select: { completion: true } },
      },
      orderBy: { name: "asc" },
    }),

    // milestones byStatus
    prisma.milestone.groupBy({
      by: ["status"],
      where: milestoneWhere,
      _count: { _all: true },
    }),

    // companies for filter dropdown
    prisma.company.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // ---------- serialise tickets monthly volume ----------
  // Build a map of the last 12 month labels in order
  const monthLabels: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    monthLabels.push(format(subMonths(now, i), "MMM yy"));
  }
  const monthCounts = new Map<string, number>(monthLabels.map((m) => [m, 0]));
  for (const t of ticketsMonthlyRaw) {
    const key = format(new Date(t.createdAt), "MMM yy");
    if (monthCounts.has(key)) {
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }
  }
  const monthlyVolume = monthLabels.map((month) => ({
    name: month,
    value: monthCounts.get(month) ?? 0,
  }));

  // ---------- serialise assets ----------
  const assetStatusMap = new Map<string, number>();
  const lifecycleCounts = { "On Track": 0, "Review Due": 0, Overdue: 0 };

  for (const asset of assetsRaw) {
    // byStatus count
    const s = formatEnum(asset.status);
    assetStatusMap.set(s, (assetStatusMap.get(s) ?? 0) + 1);

    // lifecycle risk (exclude RETIRED)
    if (asset.status !== "RETIRED") {
      const age = differenceInYears(now, new Date(asset.purchaseDate));
      const ly = asset.lifecycleYears;
      if (age >= ly) {
        lifecycleCounts["Overdue"]++;
      } else if (age >= ly - 1) {
        lifecycleCounts["Review Due"]++;
      } else {
        lifecycleCounts["On Track"]++;
      }
    }
  }

  // ---------- serialise projects ----------
  const projectList = projectsRaw.map((p) => ({
    name: p.name,
    status: p.status,
    value: Math.round(
      p.layers.reduce((sum: number, l: { completion: number }) => sum + l.completion, 0) /
        Math.max(p.layers.length, 1),
    ),
  }));

  const projectStatusMap = new Map<string, number>();
  for (const p of projectList) {
    const s = formatEnum(p.status);
    projectStatusMap.set(s, (projectStatusMap.get(s) ?? 0) + 1);
  }

  // ---------- assemble ReportData ----------
  const reportData: ReportData = {
    tickets: {
      totalOpen: ticketsTotalOpen,
      slaBreached: ticketsSlaBreached,
      byCategory: ticketsByCategory.map((r) => ({
        name: formatEnum(r.category),
        value: r._count._all,
      })),
      byStatus: ticketsByStatus.map((r) => ({
        name: formatEnum(r.status),
        value: r._count._all,
      })),
      monthlyVolume,
    },
    gaps: {
      bySeverity: gapsBySeverity.map((r) => ({
        name: formatEnum(r.severity),
        value: r._count._all,
      })),
      byStatus: gapsByStatus.map((r) => ({
        name: formatEnum(r.status),
        value: r._count._all,
      })),
    },
    assets: {
      byStatus: Array.from(assetStatusMap.entries()).map(([name, value]) => ({ name, value })),
      lifecycleRisk: [
        { name: "On Track", value: lifecycleCounts["On Track"] },
        { name: "Review Due", value: lifecycleCounts["Review Due"] },
        { name: "Overdue", value: lifecycleCounts["Overdue"] },
      ],
    },
    projects: {
      list: projectList,
      byStatus: Array.from(projectStatusMap.entries()).map(([name, value]) => ({ name, value })),
    },
    milestones: {
      byStatus: milestonesByStatus.map((r) => ({
        name: formatEnum(r.status),
        value: r._count._all,
      })),
    },
    companies,
    selectedCompanyId: companyId ?? "",
    periodMonths: months,
  };

  return <ReportsDashboard data={reportData} />;
}
