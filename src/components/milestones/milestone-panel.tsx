"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, CheckCircle2, Clock, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { milestoneUpdateSchema } from "@/lib/validators";
import { formatEnum } from "@/lib/utils";

type MilestoneStatus = "UPCOMING" | "ACTIVE" | "COMPLETED" | "DELAYED";

export type MilestoneRow = {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  completion: number;
  status: MilestoneStatus;
};

type FormValues = z.infer<typeof milestoneUpdateSchema>;

const statuses: MilestoneStatus[] = ["UPCOMING", "ACTIVE", "COMPLETED", "DELAYED"];

function statusIcon(status: MilestoneStatus) {
  if (status === "COMPLETED") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "DELAYED") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "ACTIVE") return <Clock className="h-4 w-4 text-yellow-500" />;
  return <CalendarClock className="h-4 w-4 text-muted-foreground" />;
}

function statusVariant(status: MilestoneStatus): "success" | "destructive" | "warning" | "secondary" {
  if (status === "COMPLETED") return "success";
  if (status === "DELAYED") return "destructive";
  if (status === "ACTIVE") return "warning";
  return "secondary";
}

function MilestoneForm({
  projectId,
  initial,
  onDone,
}: {
  projectId: string;
  initial?: MilestoneRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(milestoneUpdateSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          description: initial.description,
          dueDate: new Date(initial.dueDate),
          completion: initial.completion,
          status: initial.status,
        }
      : { name: "", description: "", completion: 0, status: "UPCOMING" },
  });

  function onSubmit(values: FormValues) {
    setError(null);
    startTransition(async () => {
      const url = initial ? `/api/milestones/${initial.id}` : "/api/milestones";
      const method = initial ? "PATCH" : "POST";
      const body = initial ? values : { ...values, projectId };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Save failed.");
        return;
      }

      onDone();
      router.refresh();
    });
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Field label="Name" id="name">
        <Input id="name" placeholder="Go-live sign-off" {...form.register("name")} />
      </Field>
      <Field label="Description" id="description">
        <Input id="description" placeholder="What this milestone represents" {...form.register("description")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due Date" id="dueDate">
          <Input
            id="dueDate"
            type="date"
            defaultValue={initial ? initial.dueDate.slice(0, 10) : ""}
            {...form.register("dueDate")}
          />
        </Field>
        <Field label="Completion %" id="completion">
          <Input id="completion" type="number" min={0} max={100} {...form.register("completion")} />
        </Field>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          defaultValue={initial?.status ?? "UPCOMING"}
          onValueChange={(v) => form.setValue("status", v as MilestoneStatus)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{formatEnum(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : initial ? "Save changes" : "Add milestone"}
      </Button>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function EditDialog({ projectId, milestone }: { projectId: string; milestone: MilestoneRow }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit milestone">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Milestone</DialogTitle></DialogHeader>
        <MilestoneForm projectId={projectId} initial={milestone} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" /> Add Milestone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
        <MilestoneForm projectId={projectId} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function MilestonePanel({
  projectId,
  milestones,
  canEdit = false,
}: {
  projectId: string;
  milestones: MilestoneRow[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function deleteMilestone(id: string, name: string) {
    if (!window.confirm(`Delete milestone "${name}"?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/milestones/${id}`, { method: "DELETE" });
      if (!res.ok) window.alert("Delete failed.");
      else router.refresh();
    });
  }

  const sorted = [...milestones].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const completed = sorted.filter((m) => m.status === "COMPLETED").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {completed} / {sorted.length} completed
        </div>
        {canEdit && <AddDialog projectId={projectId} />}
      </div>

      {sorted.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No milestones defined yet.{canEdit && " Click \"Add Milestone\" to create one."}
        </p>
      )}

      <div className="space-y-3">
        {sorted.map((milestone) => {
          const overdue = milestone.status !== "COMPLETED" && new Date(milestone.dueDate) < new Date();
          return (
            <div key={milestone.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="mt-0.5 shrink-0">{statusIcon(milestone.status)}</span>
                  <div className="min-w-0">
                    <div className="font-medium leading-snug">{milestone.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{milestone.description}</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant={statusVariant(milestone.status)}>{formatEnum(milestone.status)}</Badge>
                  {canEdit && (
                    <>
                      <EditDialog projectId={projectId} milestone={milestone} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMilestone(milestone.id, milestone.name)}
                        disabled={pending}
                        aria-label="Delete milestone"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className={overdue ? "font-medium text-destructive" : ""}>
                    Due {new Date(milestone.dueDate).toLocaleDateString()}{overdue ? " — overdue" : ""}
                  </span>
                  <span>{milestone.completion}%</span>
                </div>
                <Progress value={milestone.completion} className="h-1.5" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
