"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DEFAULT_COLORS = [
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

interface BarChartCardProps {
  title: string;
  description?: string;
  data: { name: string; value: number; color?: string }[];
  color?: string;
  colors?: string[];
  layout?: "vertical" | "horizontal";
}

export function BarChartCard({
  title,
  description,
  data,
  color,
  colors,
  layout = "vertical",
}: BarChartCardProps) {
  const resolvedColors = colors ?? DEFAULT_COLORS;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="px-4 pb-2 pt-4">
        <CardTitle className="truncate text-sm">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="h-52 min-w-0 px-3 pb-3 pt-0">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {layout === "horizontal" ? (
              <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={entry.color ?? color ?? resolvedColors[index % resolvedColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={data} margin={{ left: -24, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={48} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={entry.color ?? color ?? resolvedColors[index % resolvedColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No records yet</div>;
}
