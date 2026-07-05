"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Plus, RefreshCw } from "lucide-react";

type AuditEntry = {
  id: string;
  userId: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
};

type Finding = {
  id: string;
  findingId: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  controlId: string | null;
  control: { controlId: string; title: string } | null;
  responsible: { id: string; name: string } | null;
  dueDate: string | null;
  closedAt: string | null;
  notes: string | null;
  createdAt: string;
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS: "success",
  LOGIN_FAILED: "destructive",
  LOGIN_BLOCKED: "destructive",
  ACCOUNT_LOCKED: "warning",
  LOGOUT: "secondary",
  CREATE: "success",
  UPDATE: "secondary",
  DELETE: "destructive",
  EXPORT: "outline",
  PERMISSION_DENIED: "warning",
};

const SEVERITY_COLORS: Record<string, "destructive" | "warning" | "secondary" | "outline"> = {
  CRITICAL: "destructive",
  HIGH: "warning",
  MEDIUM: "secondary",
  LOW: "outline",
  INFORMATIONAL: "outline",
};

const STATUS_COLORS: Record<string, "destructive" | "warning" | "success" | "secondary" | "outline"> = {
  OPEN: "destructive",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  ACCEPTED: "secondary",
  CLOSED: "outline",
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AuditPage() {
  const PAGE_SIZE = 50;
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [logFilter, setLogFilter] = useState({ action: "", entity: "", search: "" });
  const [logPage, setLogPage] = useState(1);
  const [findingFilter, setFindingFilter] = useState({ status: "", severity: "" });
  const [detailLog, setDetailLog] = useState<AuditEntry | null>(null);
  const [findingOpen, setFindingOpen] = useState(false);
  const [newFinding, setNewFinding] = useState({ findingId: "", title: "", description: "", severity: "HIGH", status: "OPEN", notes: "" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function loadLogs() {
    const params = new URLSearchParams();
    if (logFilter.action) params.set("action", logFilter.action);
    if (logFilter.entity) params.set("entity", logFilter.entity);
    fetch(`/api/audit/logs?${params}`).then(r => r.json()).then(setLogs).catch(() => {});
  }

  function loadFindings() {
    const params = new URLSearchParams();
    if (findingFilter.status) params.set("status", findingFilter.status);
    if (findingFilter.severity) params.set("severity", findingFilter.severity);
    fetch(`/api/findings?${params}`).then(r => r.json()).then(setFindings).catch(() => {});
  }

  useEffect(() => { loadLogs(); }, [logFilter.action, logFilter.entity]);
  useEffect(() => { loadFindings(); }, [findingFilter.status, findingFilter.severity]);
  useEffect(() => { setLogPage(1); }, [logFilter]);

  const filteredLogs = useMemo(() => logs.filter(l =>
    !logFilter.search ||
    l.action.toLowerCase().includes(logFilter.search.toLowerCase()) ||
    l.entity?.toLowerCase().includes(logFilter.search.toLowerCase()) ||
    l.ip?.includes(logFilter.search) ||
    (l.user as { name?: string } | null | undefined)?.name?.toLowerCase().includes(logFilter.search.toLowerCase())
  ), [logs, logFilter.search]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs = filteredLogs.slice((logPage - 1) * PAGE_SIZE, logPage * PAGE_SIZE);

  function submitFinding() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newFinding, findingId: newFinding.findingId || `FND-${Date.now()}` }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        setError(b?.error ?? "Failed to create finding.");
        return;
      }
      setFindingOpen(false);
      setNewFinding({ findingId: "", title: "", description: "", severity: "HIGH", status: "OPEN", notes: "" });
      loadFindings();
    });
  }

  async function updateFindingStatus(id: string, status: string) {
    await fetch(`/api/findings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    loadFindings();
  }

  async function exportLogs() {
    const res = await fetch("/api/audit/export");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const openCount = findings.filter(f => f.status === "OPEN").length;
  const criticalCount = findings.filter(f => f.severity === "CRITICAL" && f.status === "OPEN").length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Audit Log & Evidence</CardTitle>
            <CardDescription>System-wide audit trail, security findings tracker, and evidence management.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && <Badge variant="destructive">{criticalCount} critical open</Badge>}
            {openCount > 0 && <Badge variant="warning">{openCount} findings open</Badge>}
            <Button variant="outline" size="sm" onClick={exportLogs}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="log" className="space-y-4">
        <TabsList>
          <TabsTrigger value="log">Audit Log</TabsTrigger>
          <TabsTrigger value="findings">
            Findings
            {openCount > 0 && <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-xs">{openCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Audit Log Tab ── */}
        <TabsContent value="log" className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Input placeholder="Search action, entity, IP, user…" value={logFilter.search} onChange={e => setLogFilter(p => ({ ...p, search: e.target.value }))} className="w-64" />
            <Select value={logFilter.action || "ALL"} onValueChange={v => setLogFilter(p => ({ ...p, action: v === "ALL" ? "" : v }))}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All actions" /></SelectTrigger>
              <SelectContent>
                {["ALL", "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGIN_BLOCKED", "ACCOUNT_LOCKED", "LOGOUT", "CREATE", "UPDATE", "DELETE", "EXPORT", "PERMISSION_DENIED"].map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={logFilter.entity || "ALL"} onValueChange={v => setLogFilter(p => ({ ...p, entity: v === "ALL" ? "" : v }))}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All entities" /></SelectTrigger>
              <SelectContent>
                {["ALL", "User", "ITAsset", "ITLicense", "Employee", "SupportTicket", "Risk", "AuditFinding", "ComplianceControl"].map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={loadLogs}><RefreshCw className="h-4 w-4" /></Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b px-4 py-2 text-sm text-muted-foreground">
                <span>{filteredLogs.length} events</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>← Prev</Button>
                  <span>Page {logPage} of {totalLogPages}</span>
                  <Button variant="ghost" size="sm" disabled={logPage >= totalLogPages} onClick={() => setLogPage(p => p + 1)}>Next →</Button>
                </div>
              </div>
              <div className="overflow-auto rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No audit events match the current filters.</TableCell></TableRow>
                    )}
                    {pagedLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                        <TableCell className="text-sm">{(log.user as { name?: string } | null | undefined)?.name ?? <span className="text-muted-foreground text-xs">System</span>}</TableCell>
                        <TableCell><Badge variant={(ACTION_COLORS[log.action] as "destructive" | "warning" | "success" | "secondary" | "outline") ?? "outline"}>{log.action}</Badge></TableCell>
                        <TableCell className="text-sm">{log.entity ? `${log.entity}${log.entityId ? ` / ${log.entityId.slice(0, 8)}` : ""}` : "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{log.ip ?? "—"}</TableCell>
                        <TableCell>
                          {log.detail ? (
                            <button className="max-w-xs truncate text-left text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => setDetailLog(log)}>
                              {JSON.stringify(log.detail).slice(0, 60)}{JSON.stringify(log.detail).length > 60 ? "…" : ""}
                            </button>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Findings Tab ── */}
        <TabsContent value="findings" className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={findingFilter.status || "ALL"} onValueChange={v => setFindingFilter(p => ({ ...p, status: v === "ALL" ? "" : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED", "CLOSED"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={findingFilter.severity || "ALL"} onValueChange={v => setFindingFilter(p => ({ ...p, severity: v === "ALL" ? "" : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All severities" /></SelectTrigger>
              <SelectContent>
                {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto">
              <Dialog open={findingOpen} onOpenChange={setFindingOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" />Log Finding</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader><DialogTitle>Log Audit Finding</DialogTitle></DialogHeader>
                  <div className="grid gap-3">
                    <div className="grid gap-1">
                      <Label>Finding ID (optional)</Label>
                      <Input placeholder="FND-001" value={newFinding.findingId} onChange={e => setNewFinding(p => ({ ...p, findingId: e.target.value }))} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Title *</Label>
                      <Input value={newFinding.title} onChange={e => setNewFinding(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Description *</Label>
                      <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newFinding.description} onChange={e => setNewFinding(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <Label>Severity</Label>
                        <Select value={newFinding.severity} onValueChange={v => setNewFinding(p => ({ ...p, severity: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label>Status</Label>
                        <Select value={newFinding.status} onValueChange={v => setNewFinding(p => ({ ...p, status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED", "CLOSED"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <Label>Notes</Label>
                      <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newFinding.notes} onChange={e => setNewFinding(p => ({ ...p, notes: e.target.value }))} />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button onClick={submitFinding} disabled={pending || !newFinding.title || !newFinding.description}>
                      {pending ? "Saving…" : "Log Finding"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-3">
            {findings.length === 0 && (
              <Card><CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-3">No audit findings logged yet. Use the button below to record your first finding.</p>
                <Dialog open={findingOpen} onOpenChange={setFindingOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Log First Finding</Button></DialogTrigger>
                </Dialog>
              </CardContent></Card>
            )}
            {findings.map(f => (
              <Card key={f.id}>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={SEVERITY_COLORS[f.severity]}>{f.severity}</Badge>
                        <Badge variant={STATUS_COLORS[f.status]}>{f.status.replace("_", " ")}</Badge>
                        <span className="text-xs text-muted-foreground font-mono">{f.findingId}</span>
                      </div>
                      <CardTitle className="mt-1 text-base">{f.title}</CardTitle>
                      {f.control && <CardDescription className="text-xs">Control: {f.control.controlId} — {f.control.title}</CardDescription>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {f.status === "OPEN" && (
                        <Button size="sm" variant="outline" onClick={() => updateFindingStatus(f.id, "IN_PROGRESS")}>Start</Button>
                      )}
                      {f.status === "IN_PROGRESS" && (
                        <Button size="sm" variant="outline" onClick={() => updateFindingStatus(f.id, "RESOLVED")}>Resolve</Button>
                      )}
                      {(f.status === "OPEN" || f.status === "IN_PROGRESS") && (
                        <Button size="sm" variant="secondary" onClick={() => updateFindingStatus(f.id, "ACCEPTED")}>Accept Risk</Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground pb-4">
                  <p>{f.description}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs">
                    {f.responsible && <span>Owner: <strong>{f.responsible.name}</strong></span>}
                    {f.dueDate && <span>Due: <strong>{new Date(f.dueDate).toLocaleDateString("en-GB")}</strong></span>}
                    {f.closedAt && <span>Closed: <strong>{new Date(f.closedAt).toLocaleDateString("en-GB")}</strong></span>}
                    <span>Logged: {new Date(f.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                  {f.notes && <p className="mt-2 text-xs italic">{f.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Audit event detail panel */}
      <Dialog open={!!detailLog} onOpenChange={v => { if (!v) setDetailLog(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Event Detail</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Time</span><span>{formatDate(detailLog.createdAt)}</span>
                <span className="text-muted-foreground">Action</span><span><Badge variant={(ACTION_COLORS[detailLog.action] as "destructive" | "warning" | "success" | "secondary" | "outline") ?? "outline"}>{detailLog.action}</Badge></span>
                <span className="text-muted-foreground">Entity</span><span>{detailLog.entity ? `${detailLog.entity}${detailLog.entityId ? ` / ${detailLog.entityId}` : ""}` : "—"}</span>
                <span className="text-muted-foreground">User</span><span>{(detailLog.user as { name?: string; email?: string } | null | undefined)?.name ?? "System"}</span>
                <span className="text-muted-foreground">IP</span><span className="font-mono">{detailLog.ip ?? "—"}</span>
              </div>
              {detailLog.detail && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Detail</p>
                  <div className="max-h-64 overflow-auto rounded border bg-muted/40 p-3">
                    {Object.entries(detailLog.detail).map(([k, v]) => (
                      <div key={k} className="flex gap-2 py-0.5 text-xs">
                        <span className="w-32 shrink-0 font-mono text-muted-foreground">{k}</span>
                        <span className="break-all font-mono">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
