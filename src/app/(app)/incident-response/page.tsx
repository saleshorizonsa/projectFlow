"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, ChevronRight, Clock, Columns2, GripVertical, LayoutList, Plus, RefreshCw, Send, Shield } from "lucide-react";

type Incident = {
  id: string;
  incidentId: string;
  title: string;
  description: string | null;
  type: string;
  severity: string;
  status: string;
  impact: string | null;
  rootCause: string | null;
  affectedSystems: string | null;
  reportedAt: string;
  containedAt: string | null;
  eradicatedAt: string | null;
  recoveredAt: string | null;
  closedAt: string | null;
  assignedTo: { id: string; name: string } | null;
  _count: { timeline: number; assets: number };
};

type IncidentDetail = Incident & {
  timeline: { id: string; action: string; detail: string | null; occurredAt: string; performedBy: { name: string } | null }[];
  review: {
    id: string;
    summary: string | null;
    timeline: string | null;
    rootCause: string | null;
    lessonsLearned: string | null;
    recommendations: string | null;
    reviewedAt: string | null;
    reviewedBy: { name: string } | null;
  } | null;
  assets: { asset: { id: string; assetTag: string; name: string } }[];
  vulnerabilities: { vulnerability: { id: string; vulnId: string; title: string; severity: string } }[];
  risks: { risk: { id: string; riskId: string; title: string; riskScore: number } }[];
};

const SEV_VARIANT: Record<string, "destructive" | "warning" | "secondary" | "outline"> = {
  CRITICAL: "destructive", HIGH: "warning", MEDIUM: "secondary", LOW: "outline",
};

const STATUS_STEPS = ["REPORTED", "INVESTIGATING", "CONTAINED", "ERADICATED", "RECOVERED", "CLOSED"];
const STATUS_LABELS: Record<string, string> = {
  REPORTED: "Reported", INVESTIGATING: "Investigating", CONTAINED: "Contained",
  ERADICATED: "Eradicated", RECOVERED: "Recovered", CLOSED: "Closed",
};

const INCIDENT_TYPES = [
  "DATA_BREACH", "RANSOMWARE", "PHISHING", "DDOS", "UNAUTHORIZED_ACCESS",
  "MALWARE", "INSIDER_THREAT", "PHYSICAL_SECURITY", "SYSTEM_OUTAGE", "OTHER",
];

function typeLabel(t: string) { return t.replace(/_/g, " "); }

function mttr(incident: Incident): string | null {
  if (!incident.closedAt) return null;
  const ms = new Date(incident.closedAt).getTime() - new Date(incident.reportedAt).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function AddIncidentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    incidentId: "", title: "", description: "", type: "OTHER", severity: "HIGH",
    affectedSystems: "", impact: "",
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, incidentId: form.incidentId || undefined }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        const msg = b?.error ?? "Failed";
        setError(msg);
        toast.error(msg);
        return;
      }
      setOpen(false);
      setForm({ incidentId: "", title: "", description: "", type: "OTHER", severity: "HIGH", affectedSystems: "", impact: "" });
      toast.success("Incident reported");
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Report Incident</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Report Security Incident</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Incident ID (auto)</Label><Input placeholder="INC-001" value={form.incidentId} onChange={e => set("incidentId", e.target.value)} /></div>
            <div className="grid gap-1">
              <Label>Severity *</Label>
              <Select value={form.severity} onValueChange={v => set("severity", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1"><Label>Title *</Label><Input value={form.title} onChange={e => set("title", e.target.value)} /></div>
          <div className="grid gap-1">
            <Label>Type *</Label>
            <Select value={form.type} onValueChange={v => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label>Description</Label><textarea className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.description} onChange={e => set("description", e.target.value)} /></div>
          <div className="grid gap-1"><Label>Affected Systems</Label><Input placeholder="e.g. ERP, Email Server" value={form.affectedSystems} onChange={e => set("affectedSystems", e.target.value)} /></div>
          <div className="grid gap-1"><Label>Business Impact</Label><Input placeholder="e.g. Production down, data exposed" value={form.impact} onChange={e => set("impact", e.target.value)} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={pending || !form.title}>{pending ? "Reporting…" : "Report Incident"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LogTimelineDialog({ incident, onLogged }: { incident: Incident; onLogged: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState("");
  const [detail, setDetail] = useState("");

  function submit() {
    startTransition(async () => {
      await fetch(`/api/incidents/${incident.id}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, detail: detail || undefined }),
      });
      setOpen(false);
      setAction("");
      setDetail("");
      onLogged();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1 text-xs"><Clock className="h-3.5 w-3.5" />Log Action</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Log Timeline Action — {incident.incidentId}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Action *</Label><Input placeholder="e.g. Isolated affected server" value={action} onChange={e => setAction(e.target.value)} /></div>
          <div className="grid gap-1"><Label>Detail</Label><textarea className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Additional details…" value={detail} onChange={e => setDetail(e.target.value)} /></div>
          <Button onClick={submit} disabled={pending || !action}>{pending ? "Logging…" : "Log Action"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PIRDialog({ incident, onSaved }: { incident: IncidentDetail; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    summary: incident.review?.summary ?? "",
    timeline: incident.review?.timeline ?? "",
    rootCause: incident.review?.rootCause ?? "",
    lessonsLearned: incident.review?.lessonsLearned ?? "",
    recommendations: incident.review?.recommendations ?? "",
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function submit() {
    startTransition(async () => {
      await fetch(`/api/incidents/${incident.id}/pir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reviewedAt: new Date() }),
      });
      setOpen(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><Send className="h-3.5 w-3.5" />{incident.review ? "Edit PIR" : "Post-Incident Review"}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Post-Incident Review — {incident.incidentId}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {[
            { k: "summary", label: "Executive Summary" },
            { k: "timeline", label: "Incident Timeline" },
            { k: "rootCause", label: "Root Cause Analysis" },
            { k: "lessonsLearned", label: "Lessons Learned" },
            { k: "recommendations", label: "Recommendations" },
          ].map(({ k, label }) => (
            <div key={k} className="grid gap-1">
              <Label>{label}</Label>
              <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={(form as Record<string, string>)[k]} onChange={e => set(k, e.target.value)} />
            </div>
          ))}
          <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save PIR"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IncidentDetailDialog({ incident: inc, onUpdated }: { incident: Incident; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [advancing, startAdvance] = useTransition();

  function load() {
    fetch(`/api/incidents/${inc.id}`).then(r => r.json()).then(setDetail).catch(() => {});
  }

  function handleOpen(v: boolean) { setOpen(v); if (v) load(); }

  function advanceStatus() {
    const idx = STATUS_STEPS.indexOf(inc.status);
    if (idx >= STATUS_STEPS.length - 1) return;
    const next = STATUS_STEPS[idx + 1];
    startAdvance(async () => {
      await fetch(`/api/incidents/${inc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      onUpdated();
      load();
    });
  }

  const stepIdx = STATUS_STEPS.indexOf(inc.status);
  const progress = Math.round((stepIdx / (STATUS_STEPS.length - 1)) * 100);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs"><ChevronRight className="h-3 w-3" />View</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">{inc.title}</DialogTitle>
        </DialogHeader>
        {!detail ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Tabs defaultValue="overview" className="space-y-3">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="timeline">Timeline ({detail.timeline.length})</TabsTrigger>
              <TabsTrigger value="pir">PIR</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Response Progress</span>
                  <span className="text-xs text-muted-foreground">{STATUS_LABELS[detail.status]}</span>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="flex gap-1 flex-wrap">
                  {STATUS_STEPS.map((s, i) => (
                    <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded ${i <= stepIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{STATUS_LABELS[s]}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={SEV_VARIANT[detail.severity]}>{detail.severity}</Badge>
                <Badge variant="outline">{typeLabel(detail.type)}</Badge>
                {detail.assignedTo && <Badge variant="secondary">{detail.assignedTo.name}</Badge>}
              </div>
              {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {detail.affectedSystems && <div><span className="text-muted-foreground">Affected: </span>{detail.affectedSystems}</div>}
                {detail.impact && <div><span className="text-muted-foreground">Impact: </span>{detail.impact}</div>}
                <div><span className="text-muted-foreground">Reported: </span>{new Date(detail.reportedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                {detail.containedAt && <div><span className="text-muted-foreground">Contained: </span>{new Date(detail.containedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>}
                {detail.closedAt && <div><span className="text-muted-foreground">Closed: </span>{new Date(detail.closedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>}
                {mttr(inc) && <div><span className="text-muted-foreground">MTTR: </span><span className="font-semibold">{mttr(inc)}</span></div>}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {detail.status !== "CLOSED" && (
                  <Button size="sm" onClick={advanceStatus} disabled={advancing}>
                    {advancing ? "Updating…" : `Advance → ${STATUS_LABELS[STATUS_STEPS[stepIdx + 1] ?? "CLOSED"]}`}
                  </Button>
                )}
                <LogTimelineDialog incident={inc} onLogged={() => { load(); onUpdated(); }} />
                {(detail.status === "RECOVERED" || detail.status === "CLOSED") && (
                  <PIRDialog incident={detail} onSaved={() => { load(); onUpdated(); }} />
                )}
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-2">
              {detail.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No timeline entries yet. Use "Log Action" to document response steps.</p>
              ) : (
                <div className="relative space-y-1 pl-4 border-l-2 border-muted">
                  {detail.timeline.map(e => (
                    <div key={e.id} className="relative pl-4">
                      <div className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                      <p className="text-sm font-medium">{e.action}</p>
                      {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(e.occurredAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {e.performedBy && ` · ${e.performedBy.name}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pir" className="space-y-3">
              {!detail.review ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No Post-Incident Review yet. Available once incident is Recovered or Closed.</p>
                  {(detail.status === "RECOVERED" || detail.status === "CLOSED") && (
                    <PIRDialog incident={detail} onSaved={() => { load(); onUpdated(); }} />
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { k: "summary", label: "Executive Summary" },
                    { k: "timeline", label: "Timeline" },
                    { k: "rootCause", label: "Root Cause" },
                    { k: "lessonsLearned", label: "Lessons Learned" },
                    { k: "recommendations", label: "Recommendations" },
                  ].map(({ k, label }) => (detail.review as Record<string, string | null>)[k] ? (
                    <div key={k}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                      <p className="text-sm whitespace-pre-wrap">{(detail.review as Record<string, string | null>)[k]}</p>
                    </div>
                  ) : null)}
                  {detail.review.reviewedAt && (
                    <p className="text-xs text-muted-foreground">Reviewed {new Date(detail.review.reviewedAt).toLocaleDateString("en-GB")}{detail.review.reviewedBy && ` by ${detail.review.reviewedBy.name}`}</p>
                  )}
                  <PIRDialog incident={detail} onSaved={() => { load(); onUpdated(); }} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="links" className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Affected Assets ({detail.assets.length})</p>
                {detail.assets.length === 0 ? <p className="text-sm text-muted-foreground">None linked.</p> : (
                  <div className="space-y-1">
                    {detail.assets.map(a => (
                      <div key={a.asset.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{a.asset.assetTag}</span>
                        <span>{a.asset.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Related Vulnerabilities ({detail.vulnerabilities.length})</p>
                {detail.vulnerabilities.length === 0 ? <p className="text-sm text-muted-foreground">None linked.</p> : (
                  <div className="space-y-1">
                    {detail.vulnerabilities.map(v => (
                      <div key={v.vulnerability.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{v.vulnerability.vulnId}</span>
                        <span>{v.vulnerability.title}</span>
                        <Badge variant={SEV_VARIANT[v.vulnerability.severity]} className="ml-auto text-xs">{v.vulnerability.severity}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Related Risks ({detail.risks.length})</p>
                {detail.risks.length === 0 ? <p className="text-sm text-muted-foreground">None linked.</p> : (
                  <div className="space-y-1">
                    {detail.risks.map(r => (
                      <div key={r.risk.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{r.risk.riskId}</span>
                        <span>{r.risk.title}</span>
                        <span className="ml-auto text-xs font-semibold">Score: {r.risk.riskScore}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Kanban board
// ---------------------------------------------------------------------------

function KanbanBoard({
  incidents,
  onLoad,
}: {
  incidents: Incident[];
  onLoad: () => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, status: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  }

  function handleDragLeave() {
    setDragOverStatus(null);
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>, newStatus: string) {
    e.preventDefault();
    setDragOverStatus(null);
    if (!draggedId) return;
    const incident = incidents.find(i => i.id === draggedId);
    setDraggedId(null);
    if (!incident || incident.status === newStatus) return;

    try {
      const res = await fetch(`/api/incidents/${draggedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("patch failed");
      toast.success(`Moved to ${STATUS_LABELS[newStatus]}`);
      onLoad();
    } catch {
      toast.error("Failed to move incident");
    }
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverStatus(null);
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {STATUS_STEPS.map(status => {
          const colIncidents = incidents.filter(i => i.status === status);
          const isOver = dragOverStatus === status;

          return (
            <div
              key={status}
              className={`flex flex-col w-64 rounded-lg border bg-muted/30 transition-colors ${isOver ? "border-primary bg-primary/5" : "border-border"}`}
              onDragOver={e => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, status)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {STATUS_LABELS[status]}
                </span>
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  {colIncidents.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 p-2 min-h-[120px]">
                {colIncidents.length === 0 ? (
                  <div className={`flex items-center justify-center flex-1 rounded border-2 border-dashed text-xs text-muted-foreground min-h-[80px] transition-colors ${isOver ? "border-primary text-primary" : "border-muted-foreground/20"}`}>
                    Drop here
                  </div>
                ) : (
                  colIncidents.map(inc => (
                    <div
                      key={inc.id}
                      draggable
                      onDragStart={e => handleDragStart(e, inc.id)}
                      onDragEnd={handleDragEnd}
                      className={`group rounded-md border bg-background p-2.5 shadow-sm cursor-grab active:cursor-grabbing transition-opacity ${draggedId === inc.id ? "opacity-40" : "opacity-100"} ${inc.severity === "CRITICAL" ? "border-destructive/40" : inc.severity === "HIGH" ? "border-orange-400/30" : ""}`}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-1 mb-1">
                            <Badge variant={SEV_VARIANT[inc.severity]} className="text-[10px] px-1 h-4">{inc.severity}</Badge>
                          </div>
                          <p className="text-xs font-medium leading-snug line-clamp-2">{inc.title}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{inc.incidentId}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{new Date(inc.reportedAt).toLocaleDateString("en-GB")}</span>
                        <IncidentDetailDialog incident={inc} onUpdated={onLoad} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IncidentResponsePage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState({ status: "", severity: "", type: "" });
  const [view, setView] = useState<"list" | "kanban">("list");

  function load() {
    const p = new URLSearchParams();
    // In kanban mode we always fetch all statuses so every column is populated
    if (view === "list" && filter.status) p.set("status", filter.status);
    if (filter.severity) p.set("severity", filter.severity);
    if (filter.type) p.set("type", filter.type);
    fetch(`/api/incidents?${p}`).then(r => r.json()).then(setIncidents).catch(() => {});
  }

  useEffect(() => { load(); }, [filter.status, filter.severity, filter.type, view]);

  const critical = incidents.filter(i => i.severity === "CRITICAL").length;
  const open = incidents.filter(i => !["RECOVERED", "CLOSED"].includes(i.status)).length;
  const closedWithMttr = incidents.filter(i => i.closedAt);
  const avgMttr = closedWithMttr.length > 0
    ? Math.round(closedWithMttr.reduce((sum, i) => sum + (new Date(i.closedAt!).getTime() - new Date(i.reportedAt).getTime()) / 3600000, 0) / closedWithMttr.length)
    : null;

  // In kanban mode, severity/type filters are applied client-side so all status
  // columns remain visible while still respecting the active filters.
  const displayedIncidents = view === "kanban"
    ? incidents.filter(i =>
        (!filter.severity || i.severity === filter.severity) &&
        (!filter.type || i.type === filter.type)
      )
    : incidents;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Incident Response</CardTitle>
            <CardDescription>Track, investigate and close security incidents. Log response actions, document root causes, and produce Post-Incident Reviews.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {critical > 0 && <Badge variant="destructive">{critical} critical</Badge>}
            {open > 0 && <Badge variant="warning">{open} open</Badge>}
            <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
            <AddIncidentDialog onCreated={load} />
          </div>
        </CardHeader>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Incidents", value: incidents.length, icon: <Shield className="h-5 w-5 text-muted-foreground" /> },
          { label: "Open", value: open, icon: <AlertCircle className="h-5 w-5 text-orange-500" /> },
          { label: "Critical", value: critical, icon: <AlertCircle className="h-5 w-5 text-red-600" /> },
          { label: avgMttr !== null ? `MTTR: ${avgMttr}h avg` : "MTTR", value: closedWithMttr.length > 0 ? `${avgMttr}h` : "—", icon: <Clock className="h-5 w-5 text-blue-500" /> },
        ].map(({ label, value, icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              {icon}
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter — hidden in kanban mode */}
        {view === "list" && (
          <Select value={filter.status || "ALL"} onValueChange={v => setFilter(p => ({ ...p, status: v === "ALL" ? "" : v }))}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>{["ALL", ...STATUS_STEPS].map(s => <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Select value={filter.severity || "ALL"} onValueChange={v => setFilter(p => ({ ...p, severity: v === "ALL" ? "" : v }))}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All severities" /></SelectTrigger>
          <SelectContent>{["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => <SelectItem key={s} value={s}>{s === "ALL" ? "All severities" : s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filter.type || "ALL"} onValueChange={v => setFilter(p => ({ ...p, type: v === "ALL" ? "" : v }))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">All types</SelectItem>{INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}</SelectContent>
        </Select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center rounded-md border border-input p-0.5 gap-0.5">
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 gap-1.5 text-xs"
            onClick={() => setView("list")}
            aria-label="List view"
          >
            <LayoutList className="h-3.5 w-3.5" />
            List
          </Button>
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 gap-1.5 text-xs"
            onClick={() => setView("kanban")}
            aria-label="Kanban view"
          >
            <Columns2 className="h-3.5 w-3.5" />
            Kanban
          </Button>
        </div>
      </div>

      {/* Kanban view */}
      {view === "kanban" && (
        <KanbanBoard incidents={displayedIncidents} onLoad={load} />
      )}

      {/* List / card grid view */}
      {view === "list" && (
        <div className="grid gap-4 md:grid-cols-2">
          {displayedIncidents.length === 0 && (
            <div className="md:col-span-2">
              <Card><CardContent className="py-12 text-center text-muted-foreground">No incidents found. Report one to start tracking your security events.</CardContent></Card>
            </div>
          )}
          {displayedIncidents.map(inc => {
            const stepIdx = STATUS_STEPS.indexOf(inc.status);
            const pct = Math.round((stepIdx / (STATUS_STEPS.length - 1)) * 100);
            return (
              <Card key={inc.id} className={inc.severity === "CRITICAL" ? "border-destructive/50" : inc.severity === "HIGH" ? "border-orange-400/40" : ""}>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1 mb-1">
                        <Badge variant={SEV_VARIANT[inc.severity]}>{inc.severity}</Badge>
                        <Badge variant="outline">{typeLabel(inc.type)}</Badge>
                      </div>
                      <CardTitle className="text-sm leading-snug">{inc.title}</CardTitle>
                      <CardDescription className="text-xs mt-0.5 font-mono">{inc.incidentId}</CardDescription>
                    </div>
                    <IncidentDetailDialog incident={inc} onUpdated={load} />
                  </div>
                </CardHeader>
                <CardContent className="pb-3 space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{STATUS_LABELS[inc.status]}</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Reported: {new Date(inc.reportedAt).toLocaleDateString("en-GB")}</span>
                    {inc._count.timeline > 0 && <span>{inc._count.timeline} actions logged</span>}
                    {inc.assignedTo && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{inc.assignedTo.name}</span>}
                    {mttr(inc) && <span className="font-semibold">MTTR: {mttr(inc)}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
