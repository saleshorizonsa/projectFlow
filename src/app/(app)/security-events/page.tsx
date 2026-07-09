"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Activity, AlertTriangle, Clock, RefreshCw, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EVENT_TYPES = [
  "LOGIN_SUCCESS", "LOGIN_FAILURE", "LOGIN_LOCKOUT",
  "MFA_ENABLED", "MFA_DISABLED", "PASSWORD_CHANGED",
  "USER_CREATED", "USER_DELETED", "ROLE_CHANGED",
  "ASSET_CREATED", "ASSET_MODIFIED", "ASSET_DELETED",
  "EMPLOYEE_CREATED", "EMPLOYEE_MODIFIED", "EMPLOYEE_EXITED",
  "VULNERABILITY_OPENED", "VULNERABILITY_ESCALATED",
  "INCIDENT_CREATED", "INCIDENT_ESCALATED",
  "CONFIG_CHANGED", "POLICY_CHANGED", "SUSPICIOUS_ACTIVITY",
];

const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;

const SEV_VARIANT: Record<string, "destructive" | "warning" | "secondary" | "outline"> = {
  CRITICAL: "destructive", HIGH: "warning", MEDIUM: "secondary", LOW: "outline", INFO: "outline",
};

type SecurityEvent = {
  id: string;
  createdAt: string;
  type: string;
  severity: string;
  actor: string | null;
  actorIp: string | null;
  resource: string | null;
  description: string;
  mitreTactic: string | null;
};

function typeLabel(t: string) { return t.replace(/_/g, " "); }

export default function SecurityEventsPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [kpi, setKpi] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState("24");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sevFilter, setSevFilter] = useState("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      hours,
      page: String(page),
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
      ...(sevFilter !== "all" ? { severity: sevFilter } : {}),
    });
    const res = await fetch(`/api/security-events?${params}`);
    if (res.ok) {
      const data: { events: SecurityEvent[]; total: number; kpi: { severity: string; _count: { id: number } }[] } = await res.json();
      setEvents(data.events);
      setTotal(data.total);
      const map: Record<string, number> = {};
      for (const e of data.kpi) map[e.severity] = e._count.id;
      setKpi(map);
    }
    setLoading(false);
  }, [hours, typeFilter, sevFilter, page]);

  useEffect(() => { void load(); }, [load]);

  const todayTotal = Object.values(kpi).reduce((s, v) => s + v, 0);
  const critical = kpi["CRITICAL"] ?? 0;
  const high = kpi["HIGH"] ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Security Events</h1>
          <p className="text-sm text-muted-foreground">
            Real-time security telemetry — login, access, configuration, and threat events.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard title="Events (24 h)" value={todayTotal} icon={Activity} />
        <KpiCard title="Critical (24 h)" value={critical} icon={AlertTriangle} danger />
        <KpiCard title="High (24 h)" value={high} icon={Shield} warning />
        <KpiCard title="Showing" value={total} icon={Clock} sub={hours === "0" ? "All time" : `Last ${hours}h`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={hours} onValueChange={v => { setHours(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 1 hour</SelectItem>
            <SelectItem value="6">Last 6 hours</SelectItem>
            <SelectItem value="24">Last 24 hours</SelectItem>
            <SelectItem value="168">Last 7 days</SelectItem>
            <SelectItem value="0">All time</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All Event Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Event Types</SelectItem>
            {EVENT_TYPES.map(t => (
              <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sevFilter} onValueChange={v => { setSevFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Severities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            {SEV_ORDER.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Severity summary pills */}
      <div className="flex flex-wrap gap-2">
        {SEV_ORDER.map(sev => {
          const count = kpi[sev] ?? 0;
          return (
            <button
              key={sev}
              onClick={() => { setSevFilter(sevFilter === sev ? "all" : sev); setPage(1); }}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
              style={{ opacity: count === 0 ? 0.4 : 1 }}
            >
              <Badge variant={SEV_VARIANT[sev]} className="px-1.5 py-0 text-[10px]">{sev}</Badge>
              <span className="text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Time</TableHead>
                  <TableHead className="w-44">Event Type</TableHead>
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-36">MITRE Tactic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Loading events…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No events found for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
                {events.map(e => (
                  <TableRow key={e.id} className="text-sm">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{typeLabel(e.type)}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={SEV_VARIANT[e.severity] ?? "outline"} className="text-xs">
                        {e.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{e.actor ?? "—"}</div>
                      {e.actorIp && <div className="text-muted-foreground">{e.actorIp}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.resource ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[260px] truncate">{e.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.mitreTactic ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {Math.min((page - 1) * 50 + 1, total)}–{Math.min(page * 50, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  title, value, icon: Icon, danger, warning, sub,
}: {
  title: string;
  value: number;
  icon: React.FC<{ className?: string }>;
  danger?: boolean;
  warning?: boolean;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${danger ? "text-destructive" : warning ? "text-orange-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${danger && value > 0 ? "text-destructive" : warning && value > 0 ? "text-orange-500" : ""}`}>
          {value}
        </div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
