"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EVENT_COLORS, EVENT_TYPE_LABELS, type CalendarEventType } from "@/lib/calendar-events";

const QUICK_TYPES: CalendarEventType[] = ["milestone", "task", "maintenance"];

export function QuickCreateDialog({ date, projects, onClose }: {
  date: string;
  projects: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<CalendarEventType>("milestone");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Milestone form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");

  function createMilestone() {
    if (!name.trim() || !projectId) { setError("Name and project are required."); return; }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || name.trim(), dueDate: date, projectId, status: "UPCOMING", completion: 0 }),
      });
      if (!res.ok) { setError("Failed to create milestone."); return; }
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add event &mdash; {date}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Type picker */}
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Event Type</Label>
            <div className="mt-2 flex gap-2">
              {QUICK_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-all",
                    type === t ? cn(EVENT_COLORS[t].bg, EVENT_COLORS[t].text, EVENT_COLORS[t].border) : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {EVENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Milestone quick form */}
          {type === "milestone" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="qc-name" className="text-xs">Name *</Label>
                <Input id="qc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Go-live sign-off" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qc-desc" className="text-xs">Description</Label>
                <Input id="qc-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Project *</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button size="sm" className="flex-1" onClick={createMilestone} disabled={pending}>{pending ? "Creating…" : "Create Milestone"}</Button>
              </div>
            </div>
          )}

          {/* Task: navigate to creation page with date pre-filled */}
          {type === "task" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Task creation requires full details. You will be taken to the task creation form with the date pre-filled.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button size="sm" className="flex-1" asChild>
                  <a href={`/tasks/new?dueDate=${date}`}>Go to Task Form</a>
                </Button>
              </div>
            </div>
          )}

          {/* Maintenance: navigate */}
          {type === "maintenance" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Maintenance windows require asset selection and scheduling. You will be taken to the maintenance creation form.</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button size="sm" className="flex-1" asChild>
                  <a href={`/it-maintenance/maintenance/new?scheduledAt=${date}`}>Go to Maintenance Form</a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
