"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DiscardChangesDialog } from "@/components/ui/discard-changes-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { id: string; name: string };
type Allocation = {
  id: string;
  userId: string;
  title: string;
  projectId: string | null;
  taskId: string | null;
  maintenanceId: string | null;
  startAt: string;
  endAt: string;
  allocationPercent: number;
  status: "PLANNED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  notes: string | null;
};

const statuses: Allocation["status"][] = ["PLANNED", "CONFIRMED", "COMPLETED", "CANCELLED"];

export function ResourceAllocationActions({
  allocation,
  users,
  projects,
  tasks,
  maintenances,
}: {
  allocation: Allocation;
  users: Option[];
  projects: Option[];
  tasks: Option[];
  maintenances: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    userId: allocation.userId,
    title: allocation.title,
    projectId: allocation.projectId ?? "",
    taskId: allocation.taskId ?? "",
    maintenanceId: allocation.maintenanceId ?? "",
    startAt: toDatetimeLocal(allocation.startAt),
    endAt: toDatetimeLocal(allocation.endAt),
    allocationPercent: String(allocation.allocationPercent),
    status: allocation.status,
    notes: allocation.notes ?? "",
  });

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setIsDirty(true);
  }

  function handleOpenChange(next: boolean) {
    if (!next && isDirty) { setDiscardOpen(true); } else { setOpen(next); }
  }

  async function save() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/resource-allocations/${allocation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          allocationPercent: Number(form.allocationPercent),
          projectId: form.projectId || "",
          taskId: form.taskId || "",
          maintenanceId: form.maintenanceId || "",
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Allocation update failed.");
        return;
      }
      setOpen(false);
      setIsDirty(false);
      router.refresh();
    });
  }

  async function remove() {
    if (!window.confirm(`Delete allocation "${allocation.title}"?`)) return;
    const response = await fetch(`/api/resource-allocations/${allocation.id}`, { method: "DELETE" });
    if (!response.ok) {
      window.alert("Allocation delete failed.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit allocation">
              <Pencil className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Edit Resource Allocation</DialogTitle></DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <Picker label="Resource" value={form.userId} onValueChange={(value) => update("userId", value)} items={users} />
              <Field label="Allocation Title" id={`title-${allocation.id}`}><Input id={`title-${allocation.id}`} value={form.title} onChange={(event) => update("title", event.target.value)} /></Field>
              <Field label="Start" id={`start-${allocation.id}`}><Input id={`start-${allocation.id}`} type="datetime-local" value={form.startAt} onChange={(event) => update("startAt", event.target.value)} /></Field>
              <Field label="End" id={`end-${allocation.id}`}><Input id={`end-${allocation.id}`} type="datetime-local" value={form.endAt} onChange={(event) => update("endAt", event.target.value)} /></Field>
              <Picker label="Project" value={form.projectId} onValueChange={(value) => update("projectId", value)} items={projects} includeNone />
              <Picker label="Task" value={form.taskId} onValueChange={(value) => update("taskId", value)} items={tasks} includeNone />
              <Picker label="Maintenance" value={form.maintenanceId} onValueChange={(value) => update("maintenanceId", value)} items={maintenances} includeNone />
              <Field label="Allocation %" id={`percent-${allocation.id}`}><Input id={`percent-${allocation.id}`} type="number" min="1" max="100" value={form.allocationPercent} onChange={(event) => update("allocationPercent", event.target.value)} /></Field>
              <Picker label="Status" value={form.status} onValueChange={(value) => update("status", value)} items={statuses.map((status) => ({ id: status, name: status.replaceAll("_", " ") }))} />
              <Field label="Notes" id={`notes-${allocation.id}`}><Input id={`notes-${allocation.id}`} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></Field>
              {message && <p className="text-sm text-destructive md:col-span-2">{message}</p>}
              <Button className="md:col-span-2" onClick={save} disabled={pending}>{pending ? "Saving..." : "Save allocation"}</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={remove} aria-label="Delete allocation">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <DiscardChangesDialog
        open={discardOpen}
        onKeep={() => setDiscardOpen(false)}
        onDiscard={() => { setDiscardOpen(false); setIsDirty(false); setOpen(false); }}
      />
    </>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function Picker({ label, value, onValueChange, items, includeNone = false }: { label: string; value: string; onValueChange: (value: string) => void; items: Option[]; includeNone?: boolean }) {
  const options = includeNone ? [{ id: "none", name: `No ${label.toLowerCase()}` }, ...items] : items;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || "none"} onValueChange={(next) => onValueChange(next === "none" ? "" : next)}>
        <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
        <SelectContent>{options.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
