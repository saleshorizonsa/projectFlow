"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, CircleDashed, Clock, Flag, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";

type MilestoneStatus = "UPCOMING" | "ACTIVE" | "COMPLETED" | "DELAYED";

type Milestone = {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  completion: number;
  status: MilestoneStatus;
  projectId: string;
};

type Project = {
  id: string;
  name: string;
  status: string;
  milestones: Milestone[];
};

const STATUS_META: Record<MilestoneStatus, { label: string; variant: "success" | "secondary" | "warning" | "destructive"; icon: React.ReactNode }> = {
  UPCOMING:  { label: "Upcoming",  variant: "secondary",   icon: <CircleDashed className="h-3.5 w-3.5" /> },
  ACTIVE:    { label: "Active",    variant: "warning",     icon: <Clock className="h-3.5 w-3.5" /> },
  COMPLETED: { label: "Completed", variant: "success",     icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  DELAYED:   { label: "Delayed",   variant: "destructive", icon: <TriangleAlert className="h-3.5 w-3.5" /> },
};

function MilestoneDialog({
  projectId,
  milestone,
  onSaved,
}: {
  projectId?: string;
  milestone?: Milestone;
  onSaved: () => void;
}) {
  const isEdit = !!milestone;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: milestone?.name ?? "",
    description: milestone?.description ?? "",
    dueDate: milestone ? milestone.dueDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    completion: String(milestone?.completion ?? 0),
    status: milestone?.status ?? "UPCOMING",
  });

  useEffect(() => {
    if (open && milestone) {
      setForm({
        name: milestone.name,
        description: milestone.description,
        dueDate: milestone.dueDate.slice(0, 10),
        completion: String(milestone.completion),
        status: milestone.status,
      });
    }
  }, [open, milestone]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const url = isEdit ? `/api/milestones/${milestone!.id}` : `/api/projects/${projectId}/milestones`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, dueDate: new Date(form.dueDate), completion: Number(form.completion) }),
      });
      if (!res.ok) { const b = await res.json().catch(() => null); setError(b?.error ?? "Failed"); return; }
      setOpen(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="icon" variant="ghost" title="Edit milestone"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button size="sm" variant="outline"><Plus className="mr-1.5 h-4 w-4" />Add Milestone</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Milestone" : "Add Milestone"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. MVP Launch" /></div>
          <div className="grid gap-1"><Label>Description</Label><Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="What does reaching this milestone mean?" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Completion %</Label><Input type="number" min={0} max={100} value={form.completion} onChange={e => set("completion", e.target.value)} /></div>
          </div>
          <div className="grid gap-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["UPCOMING", "ACTIVE", "COMPLETED", "DELAYED"] as const).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={pending || !form.name}>{pending ? "Saving…" : isEdit ? "Save Changes" : "Add Milestone"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteMilestoneButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [pending, startTransition] = useTransition();
  function del() {
    startTransition(async () => {
      await fetch(`/api/milestones/${id}`, { method: "DELETE" });
      onDeleted();
    });
  }
  return (
    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={del} disabled={pending} title="Delete milestone">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export default function MilestonesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/milestones");
      const data: Project[] = await res.json();
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const allMilestones = projects.flatMap(p => p.milestones);
  const total = allMilestones.length;
  const completed = allMilestones.filter(m => m.status === "COMPLETED").length;
  const delayed = allMilestones.filter(m => m.status === "DELAYED").length;
  const overdue = allMilestones.filter(m => m.status !== "COMPLETED" && new Date(m.dueDate) < new Date()).length;

  const activeProjects = projects.filter(p => p.milestones.length > 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5 text-primary" />Milestones</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Track key deliverables and progress gates across all projects.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {delayed > 0 && <Badge variant="destructive">{delayed} delayed</Badge>}
            {overdue > 0 && <Badge variant="warning">{overdue} overdue</Badge>}
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total", value: total, color: "" },
          { label: "Completed", value: completed, color: "text-green-600" },
          { label: "Delayed", value: delayed, color: "text-red-600" },
          { label: "Overdue", value: overdue, color: "text-orange-600" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading milestones…</CardContent></Card>
      )}

      {!loading && projects.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No projects found. Create a project first to add milestones.</CardContent></Card>
      )}

      {!loading && projects.map(project => (
        <Card key={project.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div className="min-w-0">
              <CardTitle className="text-base">{project.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{project.milestones.length} milestone{project.milestones.length !== 1 ? "s" : ""}</p>
            </div>
            <MilestoneDialog projectId={project.id} onSaved={load} />
          </CardHeader>
          <CardContent>
            {project.milestones.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No milestones yet — add the first one.</p>
            ) : (
              <div className="space-y-3">
                {project.milestones.map(m => {
                  const meta = STATUS_META[m.status];
                  const isPast = m.status !== "COMPLETED" && new Date(m.dueDate) < new Date();
                  return (
                    <div key={m.id} className={`rounded-md border p-3 ${isPast ? "border-destructive/40 bg-destructive/5" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{m.name}</span>
                            <Badge variant={meta.variant} className="flex items-center gap-1 text-xs">
                              {meta.icon}{meta.label}
                            </Badge>
                            {isPast && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                          </div>
                          {m.description && <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>}
                          <p className="mt-1 text-xs text-muted-foreground">Due: {new Date(m.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <MilestoneDialog milestone={m} onSaved={load} />
                          <DeleteMilestoneButton id={m.id} onDeleted={load} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span>{m.completion}%</span>
                        </div>
                        <Progress value={m.completion} className="h-1.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {!loading && projects.length > 0 && activeProjects.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Projects exist but have no milestones yet. Use "Add Milestone" on any project above.</CardContent></Card>
      )}
    </div>
  );
}
