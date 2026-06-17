"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AttachmentSection } from "@/components/attachments/attachment-section";
import { CommentSection } from "@/components/comments/comment-section";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  dueDate: string;
  estimatedHours: number;
  actualHours: number;
};

const priorities: NonNullable<TaskEditValues["priority"]>[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: NonNullable<TaskEditValues["status"]>[] = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED"];

export function TaskEditDialog({ task, compact = false, currentUserId = "", currentUserRole = "VIEWER" }: { task: EditableTask; compact?: boolean; currentUserId?: string; currentUserRole?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<TaskEditValues>({
    resolver: zodResolver(taskUpdateSchema),
    defaultValues: {
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: new Date(task.dueDate),
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours,
    },
  });

  async function onSubmit(values: TaskEditValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Task update failed.");
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={compact ? "icon" : "sm"} variant={compact ? "ghost" : "outline"} className={compact ? "h-7 w-7" : undefined} aria-label="Edit task">
          <Pencil className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          {!compact && "Edit"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Update execution status, priority, dates, and effort tracking.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="edit">
          <TabsList className="mb-2">
            <TabsTrigger value="edit">Details</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="attachments">Files</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
              <Field className="md:col-span-2" label="Title" id="title"><Input id="title" {...form.register("title")} /></Field>
              <Field className="md:col-span-2" label="Description" id="description"><Input id="description" {...form.register("description")} /></Field>
              <SelectField label="Priority" value={task.priority} values={priorities} onValueChange={(value) => form.setValue("priority", value as TaskEditValues["priority"])} />
              <SelectField label="Status" value={task.status} values={statuses} onValueChange={(value) => form.setValue("status", value as TaskEditValues["status"])} />
              <Field label="Due Date" id="dueDate"><Input id="dueDate" type="date" defaultValue={task.dueDate.slice(0, 10)} {...form.register("dueDate")} /></Field>
              <Field label="Estimated Hours" id="estimatedHours"><Input id="estimatedHours" type="number" step="0.25" {...form.register("estimatedHours")} /></Field>
              <Field label="Actual Hours" id="actualHours"><Input id="actualHours" type="number" step="0.25" {...form.register("actualHours")} /></Field>
              {message && <p className="text-sm text-destructive md:col-span-2">{message}</p>}
              <Button className="md:col-span-2" type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
            </form>
          </TabsContent>
          <TabsContent value="comments">
            <CommentSection
              entityType="task"
              entityId={task.id}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          </TabsContent>
          <TabsContent value="attachments">
            <AttachmentSection
              entityType="task"
              entityId={task.id}
              canDelete={["ADMIN", "PROJECT_MANAGER"].includes(currentUserRole)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SelectField({ label, value, values, onValueChange }: { label: string; value: string; values: string[]; onValueChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select defaultValue={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{values.map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
