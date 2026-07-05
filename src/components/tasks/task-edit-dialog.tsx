"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GitBranch, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AttachmentSection } from "@/components/attachments/attachment-section";
import { CommentSection } from "@/components/comments/comment-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DiscardChangesDialog } from "@/components/ui/discard-changes-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { taskUpdateSchema } from "@/lib/validators";

type TaskEditValues = z.infer<typeof taskUpdateSchema>;

export type EditableTask = {
  id: string;
  title: string;
  description: string;
  priority: NonNullable<TaskEditValues["priority"]>;
  status: NonNullable<TaskEditValues["status"]>;
  startDate: string | null;
  dueDate: string;
  estimatedHours: number;
  actualHours: number;
  assigneeId: string;
  parentTaskId: string | null;
};

type Subtask = { id: string; title: string; status: string; assignee: { name: string }; dueDate: string };

const priorities: NonNullable<TaskEditValues["priority"]>[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: NonNullable<TaskEditValues["status"]>[] = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED"];

export function TaskEditDialog({
  task,
  compact = false,
  calendarMode = false,
  currentUserId = "",
  currentUserRole = "VIEWER",
}: {
  task: EditableTask;
  compact?: boolean;
  calendarMode?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskPending, startSubtaskTransition] = useTransition();

  const form = useForm<TaskEditValues>({
    resolver: zodResolver(taskUpdateSchema),
    defaultValues: {
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      startDate: task.startDate ? new Date(task.startDate) : null,
      dueDate: new Date(task.dueDate),
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
      assigneeId: task.assigneeId,
    },
  });

  function loadSubtasks() {
    fetch(`/api/tasks?parentTaskId=${task.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSubtasks(data);
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (open) loadSubtasks();
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (!next && form.formState.isDirty) {
      setDiscardOpen(true);
    } else {
      setOpen(next);
    }
  }

  async function onSubmit(values: TaskEditValues) {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setMessage(body?.error ?? "Task update failed.");
        return;
      }
      form.reset(values);
      setOpen(false);
      router.refresh();
    });
  }

  function addSubtask() {
    if (!newSubtaskTitle.trim()) return;
    startSubtaskTransition(async () => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "GENERAL",
          title: newSubtaskTitle.trim(),
          description: `Subtask of: ${task.title}`,
          priority: task.priority,
          status: "NOT_STARTED",
          assigneeId: task.assigneeId,
          dueDate: task.dueDate,
          estimatedHours: 1,
          parentTaskId: task.id,
        }),
      });
      if (res.ok) {
        setNewSubtaskTitle("");
        setAddingSubtask(false);
        loadSubtasks();
        router.refresh();
      }
    });
  }

  // Calendar mode: render a compact pill instead of icon button
  const trigger = calendarMode ? (
    <button
      className={`w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium ${
        task.status === "COMPLETED" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" :
        task.priority === "CRITICAL" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" :
        task.priority === "HIGH" ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200" :
        "bg-primary/10 text-primary"
      }`}
      title={task.title}
    >
      {task.title}
    </button>
  ) : (
    <Button
      size={compact ? "icon" : "sm"}
      variant={compact ? "ghost" : "outline"}
      className={compact ? "h-7 w-7" : undefined}
      aria-label="Edit task"
    >
      <Pencil className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {!compact && "Edit"}
    </Button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update execution status, priority, dates, and effort tracking.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="edit">
            <TabsList className="mb-2">
              <TabsTrigger value="edit">Details</TabsTrigger>
              <TabsTrigger value="subtasks">
                Subtasks
                {subtasks.length > 0 && (
                  <Badge variant="outline" className="ml-1 text-[9px] px-1">{subtasks.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="attachments">Files</TabsTrigger>
            </TabsList>

            {/* ── Details ── */}
            <TabsContent value="edit">
              <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
                <Field className="md:col-span-2" label="Title" id="title">
                  <Input id="title" {...form.register("title")} />
                </Field>
                <Field className="md:col-span-2" label="Description" id="description">
                  <Input id="description" {...form.register("description")} />
                </Field>
                <SelectField label="Priority" value={task.priority} values={priorities} onValueChange={(v) => form.setValue("priority", v as TaskEditValues["priority"])} />
                <SelectField label="Status" value={task.status} values={statuses} onValueChange={(v) => form.setValue("status", v as TaskEditValues["status"])} />
                <Field label="Start Date" id="startDate">
                  <Input id="startDate" type="date" defaultValue={task.startDate ? task.startDate.slice(0, 10) : ""} {...form.register("startDate")} />
                </Field>
                <Field label="Due Date" id="dueDate">
                  <Input id="dueDate" type="date" defaultValue={task.dueDate.slice(0, 10)} {...form.register("dueDate")} />
                </Field>
                <Field label="Estimated Hours" id="estimatedHours">
                  <Input id="estimatedHours" type="number" step="0.25" {...form.register("estimatedHours")} />
                </Field>
                <Field label="Actual Hours" id="actualHours">
                  <Input id="actualHours" type="number" step="0.25" {...form.register("actualHours")} />
                </Field>
                {message && <p className="text-sm text-destructive md:col-span-2">{message}</p>}
                <Button className="md:col-span-2" type="submit" disabled={pending}>
                  {pending ? "Saving..." : "Save changes"}
                </Button>
              </form>
            </TabsContent>

            {/* ── Subtasks ── */}
            <TabsContent value="subtasks" className="space-y-3">
              <div className="space-y-1">
                {subtasks.length === 0 && (
                  <p className="text-sm text-muted-foreground">No subtasks yet.</p>
                )}
                {subtasks.map((st) => (
                  <div key={st.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{st.title}</span>
                      </div>
                      <div className="ml-5 text-xs text-muted-foreground">{st.assignee.name} · due {new Date(st.dueDate).toLocaleDateString("en-GB")}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] ml-2 shrink-0">{st.status.replace(/_/g, " ")}</Badge>
                  </div>
                ))}
              </div>
              {addingSubtask ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="Subtask title…"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addSubtask(); if (e.key === "Escape") setAddingSubtask(false); }}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" className="h-8" onClick={addSubtask} disabled={subtaskPending}>Add</Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingSubtask(false)}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setAddingSubtask(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add subtask
                </Button>
              )}
            </TabsContent>

            {/* ── Comments ── */}
            <TabsContent value="comments">
              <CommentSection entityType="task" entityId={task.id} currentUserId={currentUserId} currentUserRole={currentUserRole} />
            </TabsContent>

            {/* ── Attachments ── */}
            <TabsContent value="attachments">
              <AttachmentSection entityType="task" entityId={task.id} canDelete={["ADMIN", "PROJECT_MANAGER"].includes(currentUserRole)} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog
        open={discardOpen}
        onKeep={() => setDiscardOpen(false)}
        onDiscard={() => { setDiscardOpen(false); form.reset(); setOpen(false); }}
      />
    </>
  );
}

function Field({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SelectField({ label, value, values, onValueChange }: { label: string; value: string; values: string[]; onValueChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select defaultValue={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
