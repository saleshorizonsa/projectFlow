"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Check, ChevronRight, Plus, RefreshCw, Trash2 } from "lucide-react";

type PlaybookStep = {
  order: number;
  title: string;
  description: string;
  checklist: string[];
};

type Playbook = {
  id: string;
  playbookId: string;
  title: string;
  type: string;
  description: string | null;
  steps: PlaybookStep[];
  createdAt: string;
};

const INCIDENT_TYPES = [
  "DATA_BREACH", "RANSOMWARE", "PHISHING", "DDOS", "UNAUTHORIZED_ACCESS",
  "MALWARE", "INSIDER_THREAT", "PHYSICAL_SECURITY", "SYSTEM_OUTAGE", "OTHER",
];

const TYPE_COLOR: Record<string, string> = {
  DATA_BREACH: "text-red-600 bg-red-50 border-red-200",
  RANSOMWARE: "text-red-700 bg-red-100 border-red-300",
  PHISHING: "text-orange-600 bg-orange-50 border-orange-200",
  DDOS: "text-yellow-700 bg-yellow-50 border-yellow-200",
  UNAUTHORIZED_ACCESS: "text-purple-600 bg-purple-50 border-purple-200",
  MALWARE: "text-orange-700 bg-orange-100 border-orange-300",
  INSIDER_THREAT: "text-indigo-600 bg-indigo-50 border-indigo-200",
  PHYSICAL_SECURITY: "text-gray-600 bg-gray-50 border-gray-200",
  SYSTEM_OUTAGE: "text-blue-600 bg-blue-50 border-blue-200",
  OTHER: "text-muted-foreground bg-muted border-border",
};

function typeLabel(t: string) { return t.replace(/_/g, " "); }

const DEFAULT_STEPS: PlaybookStep[] = [
  { order: 1, title: "Identification", description: "Confirm and classify the incident.", checklist: ["Verify the alert or report", "Assign severity and type", "Notify incident commander"] },
  { order: 2, title: "Containment", description: "Limit the scope and prevent further damage.", checklist: ["Isolate affected systems", "Preserve evidence", "Notify stakeholders"] },
  { order: 3, title: "Eradication", description: "Remove the threat from all systems.", checklist: ["Remove malware or threat", "Patch vulnerabilities", "Reset credentials"] },
  { order: 4, title: "Recovery", description: "Restore systems to normal operation.", checklist: ["Restore from clean backups", "Monitor for recurrence", "Confirm systems are clean"] },
  { order: 5, title: "Lessons Learned", description: "Document findings and improve defences.", checklist: ["Hold post-incident review", "Update playbook", "Report to management"] },
];

function AddPlaybookDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ playbookId: "", title: "", type: "OTHER", description: "" });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, playbookId: form.playbookId || undefined, steps: DEFAULT_STEPS }),
      });
      if (!res.ok) { const b = await res.json().catch(() => null); setError(b?.error ?? "Failed"); return; }
      setOpen(false);
      setForm({ playbookId: "", title: "", type: "OTHER", description: "" });
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New Playbook</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Incident Playbook</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Playbook ID (auto)</Label><Input placeholder="PB-001" value={form.playbookId} onChange={e => set("playbookId", e.target.value)} /></div>
          <div className="grid gap-1"><Label>Title *</Label><Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Ransomware Response Playbook" /></div>
          <div className="grid gap-1">
            <Label>Incident Type *</Label>
            <Select value={form.type} onValueChange={v => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label>Description</Label><textarea className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.description} onChange={e => set("description", e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">A default 5-step IR playbook will be created. Edit steps after creation.</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={pending || !form.title}>{pending ? "Creating…" : "Create Playbook"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlaybookDetailDialog({ playbook, onDeleted }: { playbook: Playbook; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [deleting, startDelete] = useTransition();

  function toggleCheck(key: string) { setChecked(p => ({ ...p, [key]: !p[key] })); }

  function deletePlaybook() {
    startDelete(async () => {
      await fetch(`/api/playbooks/${playbook.id}`, { method: "DELETE" });
      setOpen(false);
      onDeleted();
    });
  }

  const totalChecks = playbook.steps.reduce((s, step) => s + step.checklist.length, 0);
  const completedChecks = Object.values(checked).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs"><ChevronRight className="h-3 w-3" />View</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="text-base">{playbook.title}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">{playbook.playbookId}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={deletePlaybook} disabled={deleting} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          {totalChecks > 0 && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="font-semibold">{completedChecks}</span> / {totalChecks} checklist items completed
            </div>
          )}
          {playbook.description && <p className="text-sm text-muted-foreground">{playbook.description}</p>}
          {playbook.steps.map(step => (
            <div key={step.order} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{step.order}</span>
                <h4 className="font-semibold text-sm">{step.title}</h4>
              </div>
              {step.description && <p className="text-sm text-muted-foreground pl-8">{step.description}</p>}
              {step.checklist.length > 0 && (
                <div className="pl-8 space-y-1">
                  {step.checklist.map((item, ci) => {
                    const key = `${step.order}-${ci}`;
                    return (
                      <label key={key} className="flex cursor-pointer items-start gap-2 text-sm">
                        <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked[key] ? "bg-primary border-primary text-primary-foreground" : "border-input"}`} onClick={() => toggleCheck(key)}>
                          {checked[key] && <Check className="h-3 w-3" />}
                        </div>
                        <span className={checked[key] ? "line-through text-muted-foreground" : ""}>{item}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [typeFilter, setTypeFilter] = useState("");

  function load() {
    const p = new URLSearchParams();
    if (typeFilter) p.set("type", typeFilter);
    fetch(`/api/playbooks?${p}`).then(r => r.json()).then(setPlaybooks).catch(() => {});
  }

  useEffect(() => { load(); }, [typeFilter]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Incident Response Playbooks</CardTitle>
            <CardDescription>Standardised step-by-step response procedures for each incident type. Use as a live checklist during an active incident.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
            <AddPlaybookDialog onCreated={load} />
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter || "ALL"} onValueChange={v => setTypeFilter(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">All types</SelectItem>{INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {playbooks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No playbooks yet. Create your first incident response playbook.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {playbooks.map(pb => (
            <Card key={pb.id}>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded border mb-1.5 ${TYPE_COLOR[pb.type] ?? TYPE_COLOR.OTHER}`}>
                      {typeLabel(pb.type)}
                    </span>
                    <CardTitle className="text-sm leading-snug">{pb.title}</CardTitle>
                    <CardDescription className="text-xs mt-0.5 font-mono">{pb.playbookId}</CardDescription>
                  </div>
                  <PlaybookDetailDialog playbook={pb} onDeleted={load} />
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                {pb.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{pb.description}</p>}
                <div className="flex flex-wrap gap-1">
                  {pb.steps.map(s => (
                    <span key={s.order} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{s.order}. {s.title}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
