"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Plus, RefreshCw, XCircle, AlertCircle, Clock } from "lucide-react";
import { DiscardChangesDialog } from "@/components/ui/discard-changes-dialog";

type BackupLog = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationMinutes: number | null;
  sizeBytes: string | null;
  errorMessage: string | null;
};

type BackupJob = {
  id: string;
  jobId: string;
  name: string;
  frequency: string;
  rpoHours: number;
  retentionDays: number;
  lastRunAt: string | null;
  lastStatus: string;
  lastSizeBytes: string | null;
  nextRunAt: string | null;
  isActive: boolean;
  notes: string | null;
  asset: { id: string; assetTag: string; name: string } | null;
  logs: BackupLog[];
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  SUCCESS: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  PARTIAL: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  FAILED: <XCircle className="h-4 w-4 text-red-600" />,
  UNKNOWN: <Clock className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  SUCCESS: "success", PARTIAL: "warning", FAILED: "destructive", UNKNOWN: "secondary",
};

function formatBytes(bytes: string | null) {
  if (!bytes) return "—";
  const n = Number(bytes);
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${(n / 1e3).toFixed(0)} KB`;
}

function rpoStatus(job: BackupJob): "ok" | "at-risk" | "breached" | "unknown" {
  if (!job.lastRunAt) return "unknown";
  const hoursSince = (Date.now() - new Date(job.lastRunAt).getTime()) / 3600000;
  if (hoursSince > job.rpoHours) return "breached";
  if (hoursSince > job.rpoHours * 0.8) return "at-risk";
  return "ok";
}

function AddJobDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [form, setForm] = useState({ jobId: "", name: "", frequency: "DAILY", rpoHours: "24", retentionDays: "30", notes: "" });
  const set = (k: string, v: string) => { setForm(p => ({ ...p, [k]: v })); setIsDirty(true); };

  function handleOpenChange(v: boolean) {
    if (!v && isDirty) { setDiscardOpen(true); return; }
    if (!v) { setIsDirty(false); }
    setOpen(v);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/backup-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, jobId: form.jobId || `BKP-${Date.now()}`, rpoHours: Number(form.rpoHours), retentionDays: Number(form.retentionDays) }),
      });
      if (!res.ok) { const b = await res.json().catch(() => null); setError(b?.error ?? "Failed"); return; }
      setOpen(false);
      setIsDirty(false);
      setForm({ jobId: "", name: "", frequency: "DAILY", rpoHours: "24", retentionDays: "30", notes: "" });
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Backup Job</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Register Backup Job</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1"><Label>Job ID (optional)</Label><Input placeholder="BKP-001" value={form.jobId} onChange={e => set("jobId", e.target.value)} /></div>
          <div className="grid gap-1 md:col-span-2"><Label>Job Name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. SQL Server Full Backup — Nightly" /></div>
          <div className="grid gap-1">
            <Label>Frequency</Label>
            <Select value={form.frequency} onValueChange={v => set("frequency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["HOURLY", "DAILY", "WEEKLY", "MONTHLY"].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label>RPO Target (hours)</Label><Input type="number" min={1} value={form.rpoHours} onChange={e => set("rpoHours", e.target.value)} /></div>
          <div className="grid gap-1"><Label>Retention (days)</Label><Input type="number" min={1} value={form.retentionDays} onChange={e => set("retentionDays", e.target.value)} /></div>
          <div className="grid gap-1 md:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
          {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
          <div className="md:col-span-2"><Button onClick={submit} disabled={pending || !form.name}>{pending ? "Saving…" : "Register Job"}</Button></div>
        </div>
      </DialogContent>
      <DiscardChangesDialog
        open={discardOpen}
        onKeep={() => setDiscardOpen(false)}
        onDiscard={() => { setDiscardOpen(false); setIsDirty(false); setOpen(false); }}
      />
    </Dialog>
  );
}

function LogRunDialog({ job, onLogged }: { job: BackupJob; onLogged: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ status: "SUCCESS", startedAt: new Date().toISOString().slice(0, 16), durationMinutes: "", sizeBytes: "", errorMessage: "" });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function submit() {
    startTransition(async () => {
      await fetch(`/api/backup-jobs/${job.id}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: form.status,
          startedAt: new Date(form.startedAt),
          completedAt: new Date(),
          durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
          sizeBytes: form.sizeBytes ? form.sizeBytes : undefined,
          errorMessage: form.errorMessage || undefined,
        }),
      });
      setOpen(false);
      onLogged();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="text-xs h-7">Log Run</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Log Backup Run — {job.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["SUCCESS", "PARTIAL", "FAILED"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label>Started At</Label><Input type="datetime-local" value={form.startedAt} onChange={e => set("startedAt", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Duration (min)</Label><Input type="number" min={0} value={form.durationMinutes} onChange={e => set("durationMinutes", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Size (bytes)</Label><Input type="number" min={0} value={form.sizeBytes} onChange={e => set("sizeBytes", e.target.value)} /></div>
          </div>
          {form.status !== "SUCCESS" && <div className="grid gap-1"><Label>Error / Note</Label><Input value={form.errorMessage} onChange={e => set("errorMessage", e.target.value)} /></div>}
          <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Log Run"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BackupMonitoringPage() {
  const [jobs, setJobs] = useState<BackupJob[]>([]);

  function load() {
    fetch("/api/backup-jobs").then(r => r.json()).then(setJobs).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  const breached = jobs.filter(j => j.isActive && rpoStatus(j) === "breached").length;
  const atRisk = jobs.filter(j => j.isActive && rpoStatus(j) === "at-risk").length;
  const failed = jobs.filter(j => j.lastStatus === "FAILED").length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Backup Monitoring</CardTitle>
            <CardDescription>Track backup job health, RPO compliance, and run history across all systems.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {breached > 0 && <Badge variant="destructive">{breached} RPO breached</Badge>}
            {atRisk > 0 && <Badge variant="warning">{atRisk} at risk</Badge>}
            {failed > 0 && <Badge variant="destructive">{failed} last run failed</Badge>}
            <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
            <AddJobDialog onCreated={load} />
          </div>
        </CardHeader>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Jobs", value: jobs.length, color: "" },
          { label: "Healthy", value: jobs.filter(j => j.lastStatus === "SUCCESS").length, color: "text-green-600" },
          { label: "Failed", value: failed, color: "text-red-600" },
          { label: "RPO Breached", value: breached, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>RPO Target</TableHead>
                  <TableHead>RPO Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Last Status</TableHead>
                  <TableHead>Last Size</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No backup jobs registered yet. Add a job to start tracking.</TableCell></TableRow>
                )}
                {jobs.map(job => {
                  const rpo = rpoStatus(job);
                  const lastLog = job.logs?.[0];
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{job.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{job.jobId}</div>
                        {job.asset && <div className="text-xs text-muted-foreground">{job.asset.assetTag} — {job.asset.name}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{job.frequency}</TableCell>
                      <TableCell className="text-sm">{job.rpoHours}h</TableCell>
                      <TableCell>
                        {rpo === "ok" && <Badge variant="success">OK</Badge>}
                        {rpo === "at-risk" && <Badge variant="warning">At Risk</Badge>}
                        {rpo === "breached" && <Badge variant="destructive">BREACHED</Badge>}
                        {rpo === "unknown" && <Badge variant="secondary">No Data</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {STATUS_ICON[job.lastStatus]}
                          <Badge variant={STATUS_VARIANT[job.lastStatus]}>{job.lastStatus}</Badge>
                        </div>
                        {lastLog?.errorMessage && <p className="text-xs text-destructive mt-0.5">{lastLog.errorMessage}</p>}
                      </TableCell>
                      <TableCell className="text-sm">{formatBytes(job.lastSizeBytes?.toString() ?? null)}</TableCell>
                      <TableCell>
                        <LogRunDialog job={job} onLogged={load} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
