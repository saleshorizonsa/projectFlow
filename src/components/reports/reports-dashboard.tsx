"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  ShieldAlert,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cell, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AreaChartCard } from "@/components/reports/area-chart-card";
import { BarChartCard } from "@/components/reports/bar-chart-card";
import { PieChartCard } from "@/components/reports/pie-chart-card";

const CHART_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#a855f7",
  "#10b981",
  "#64748b",
  "#ef4444",
  "#14b8a6",
  "#8b5cf6",
  "#f97316",
  "#06b6d4",
];

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

function KpiCard({
  title,
  value,
  sub,
  subVariant = "default",
  icon: Icon,
}: {
  title: string;
  value: string;
  sub?: string;
  subVariant?: "default" | "destructive";
  icon: React.ElementType;
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="flex min-h-24 items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-muted-foreground">{title}</div>
          <div className="mt-2 text-3xl font-semibold leading-none">{value}</div>
          {sub && (
            <div
              className={`mt-1.5 text-xs font-medium ${subVariant === "destructive" ? "text-red-500" : "text-muted-foreground"}`}
            >
              {sub}
            </div>
          )}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectCompletionChart({ projects }: { projects: { name: string; value: number; status: string }[] }) {
  if (projects.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No projects yet</div>;
  }

  const data = projects.map((p) => ({
    ...p,
    fill:
      p.status === "COMPLETED"
        ? "#10b981"
        : p.status === "IN_PROGRESS"
          ? "#f59e0b"
          : "#64748b",
  }));

  const barHeight = 36;
  const chartHeight = Math.max(200, data.length * barHeight + 60);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
        <Tooltip formatter={(v: number) => [`${v}%`, "Completion"]} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReportsDashboard({ data }: { data: ReportData }) {
  const router = useRouter();

  const slaCompliancePct =
    data.tickets.totalOpen > 0
      ? Math.round((1 - data.tickets.slaBreached / data.tickets.totalOpen) * 100)
      : 100;

  const openGaps = data.gaps.bySeverity.reduce((sum, g) => sum + g.value, 0);

  const lifecycleRiskCount = data.assets.lifecycleRisk
    .filter((b) => b.name === "Review Due" || b.name === "Overdue")
    .reduce((sum, b) => sum + b.value, 0);

  function buildUrl(companyId: string, period: number) {
    const params = new URLSearchParams();
    if (companyId && companyId !== "all") params.set("company", companyId);
    if (period !== 12) params.set("period", String(period));
    const qs = params.toString();
    return qs ? `/reports?${qs}` : "/reports";
  }

  function handleCompanyChange(value: string) {
    router.push(buildUrl(value, data.periodMonths));
  }

  function handlePeriodChange(value: string) {
    router.push(buildUrl(data.selectedCompanyId, Number(value)));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports &amp; Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live operational metrics across tickets, gaps, assets, and projects.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            defaultValue={String(data.periodMonths)}
            onValueChange={handlePeriodChange}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 30 days</SelectItem>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Select
            defaultValue={data.selectedCompanyId || "all"}
            onValueChange={handleCompanyChange}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {data.companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 1 — KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Open Tickets"
          value={String(data.tickets.totalOpen)}
          sub={
            data.tickets.slaBreached > 0
              ? `${data.tickets.slaBreached} SLA breached`
              : undefined
          }
          subVariant="destructive"
          icon={Ticket}
        />
        <KpiCard
          title="SLA Compliance"
          value={`${slaCompliancePct}%`}
          sub={
            data.tickets.totalOpen === 0
              ? "No open tickets"
              : `${data.tickets.totalOpen - data.tickets.slaBreached} within SLA`
          }
          icon={Activity}
        />
        <KpiCard
          title="Open Gaps"
          value={String(openGaps)}
          sub="Across all severities"
          icon={AlertTriangle}
        />
        <KpiCard
          title="Asset Lifecycle Risk"
          value={String(lifecycleRiskCount)}
          sub="Review Due + Overdue"
          subVariant={lifecycleRiskCount > 0 ? "destructive" : "default"}
          icon={ShieldAlert}
        />
      </div>

      {/* Row 2 — Ticket Volume + Tickets by Category */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AreaChartCard
          title="Ticket Volume (12 Months)"
          description="Monthly support ticket count"
          data={data.tickets.monthlyVolume}
          color="#3b82f6"
        />
        <BarChartCard
          title="Tickets by Category"
          data={data.tickets.byCategory}
          colors={CHART_COLORS}
          layout="horizontal"
        />
      </div>

      {/* Row 3 — Tickets by Status + Gaps by Severity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Tickets by Status"
          data={data.tickets.byStatus}
          colors={CHART_COLORS}
        />
        <BarChartCard
          title="Gaps by Severity"
          data={data.gaps.bySeverity}
          colors={["#10b981", "#f59e0b", "#f97316", "#ef4444"]}
        />
      </div>

      {/* Row 4 — Asset Status + Lifecycle Risk */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PieChartCard
          title="Asset Status Breakdown"
          data={data.assets.byStatus}
          colors={["#10b981", "#f59e0b", "#64748b", "#3b82f6"]}
          donut
        />
        <BarChartCard
          title="Asset Lifecycle Risk"
          description="On Track / Review Due / Overdue"
          data={data.assets.lifecycleRisk}
          colors={["#10b981", "#f59e0b", "#ef4444"]}
        />
      </div>

      {/* Row 5 — Project Completion (full width) */}
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart2 className="h-4 w-4" />
            Project Completion
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-48 min-w-0 overflow-x-auto px-3 pb-3 pt-0">
          <ProjectCompletionChart projects={data.projects.list} />
        </CardContent>
      </Card>

      {/* Row 6 — Milestones by Status + Gaps by Status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PieChartCard
          title="Milestones by Status"
          data={data.milestones.byStatus}
          colors={["#3b82f6", "#10b981", "#f59e0b", "#ef4444"]}
        />
        <BarChartCard
          title="Gaps by Status"
          data={data.gaps.byStatus}
          colors={CHART_COLORS}
        />
      </div>
    </div>
  );
}
