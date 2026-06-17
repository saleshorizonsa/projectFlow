"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
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

interface PieChartCardProps {
  title: string;
  description?: string;
  data: { name: string; value: number }[];
  colors?: string[];
  donut?: boolean;
}

export function PieChartCard({ title, description, data, colors, donut = false }: PieChartCardProps) {
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
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={donut ? "40%" : 0}
                outerRadius="70%"
                dataKey="value"
                nameKey="name"
                label={false}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={resolvedColors[index % resolvedColors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value, ""]} />
              <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
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
