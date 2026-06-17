"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChartPoint = { name: string; value: number };
type TrendPoint = { name: string; opened: number; closed: number };
type ResourcePoint = { name: string; allocated: number; capacity: number };

export function AnalyticsCharts({
  projectProgress,
  gapTrend,
  taskCompletion,
  resourceUtilization,
}: {
  projectProgress: ChartPoint[];
  gapTrend: TrendPoint[];
  taskCompletion: ChartPoint[];
  resourceUtilization: ResourcePoint[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
      <ChartCard title="Project Progress">
        {projectProgress.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projectProgress} margin={{ left: -24, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </ChartCard>
      <ChartCard title="Gap Trend">
        {gapTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gapTrend} margin={{ left: -24, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} minTickGap={8} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Line type="monotone" dataKey="opened" stroke="#ef4444" strokeWidth={2} />
              <Line type="monotone" dataKey="closed" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </ChartCard>
      <ChartCard title="Task Completion Rate">
        {taskCompletion.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={taskCompletion} margin={{ left: -24, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={54} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </ChartCard>
      <ChartCard title="Resource Utilization">
        {resourceUtilization.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={resourceUtilization} margin={{ left: -24, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} minTickGap={8} />
              <YAxis tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Bar dataKey="allocated" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="capacity" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="px-4 pb-2 pt-4">
        <CardTitle className="truncate text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-44 min-w-0 px-3 pb-3 pt-0 sm:h-48">{children}</CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No records yet</div>;
}
