"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { taskSchema } from "@/lib/validators";

type TaskFormValues = z.infer<typeof taskSchema>;

type ProjectOption = {
  id: string;
  name: string;
  layers: {
    id: string;
    name: string;
    subLayers: { id: string; name: string }[];
  }[];
};

type UserOption = { id: string; name: string };

export function TaskForm({ projects, users }: { projects: ProjectOption[]; users: UserOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const firstProject = projects[0];
  const firstLayer = firstProject?.layers[0];
  const firstSubLayer = firstLayer?.subLayers[0];
  const firstUser = users[0];

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      projectId: firstProject?.id ?? "",
      layerId: firstLayer?.id ?? "",
      subLayerId: firstSubLayer?.id ?? "",
      priority: "MEDIUM",
      assigneeId: firstUser?.id ?? "",
      estimatedHours: 1,
      actualHours: 0,
      status: "NOT_STARTED",
    },
  });

  const projectId = form.watch("projectId");
  const layerId = form.watch("layerId");
  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId), [projectId, projects]);
  const selectedLayer = useMemo(() => selectedProject?.layers.find((layer) => layer.id === layerId), [layerId, selectedProject]);

  function selectProject(id: string) {
    const project = projects.find((item) => item.id === id);
    const layer = project?.layers[0];
    const subLayer = layer?.subLayers[0];
    form.setValue("projectId", id);
    form.setValue("layerId", layer?.id ?? "");
    form.setValue("subLayerId", subLayer?.id ?? "");
  }

  function selectLayer(id: string) {
    const layer = selectedProject?.layers.find((item) => item.id === id);
    form.setValue("layerId", id);
    form.setValue("subLayerId", layer?.subLayers[0]?.id ?? "");
  }

  async function onSubmit(values: TaskFormValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Task could not be created.");
        return;
      }

      form.reset({ ...values, title: "", description: "", estimatedHours: 1, actualHours: 0, status: "NOT_STARTED" });
      setMessage("Task created and reflected in execution views.");
      router.push("/tasks");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create Task</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register("title")} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...form.register("description")} />
          </div>
          <Picker label="Project" value={projectId} onValueChange={selectProject} items={projects.map((project) => ({ value: project.id, label: project.name }))} />
          <Picker label="Layer" value={layerId} onValueChange={selectLayer} items={(selectedProject?.layers ?? []).map((layer) => ({ value: layer.id, label: layer.name }))} />
          <Picker label="Sub Layer" value={form.watch("subLayerId")} onValueChange={(value) => form.setValue("subLayerId", value)} items={(selectedLayer?.subLayers ?? []).map((subLayer) => ({ value: subLayer.id, label: subLayer.name }))} />
          <Picker label="Assignee" value={form.watch("assigneeId")} onValueChange={(value) => form.setValue("assigneeId", value)} items={users.map((user) => ({ value: user.id, label: user.name }))} />
          <Picker label="Priority" value={form.watch("priority")} onValueChange={(value) => form.setValue("priority", value as TaskFormValues["priority"])} items={["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => ({ value, label: value }))} />
          <Picker label="Status" value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as TaskFormValues["status"])} items={["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} />
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input id="dueDate" type="date" {...form.register("dueDate")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedHours">Estimated Hours</Label>
            <Input id="estimatedHours" type="number" min="0.25" step="0.25" {...form.register("estimatedHours")} />
          </div>
          {message && <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-4">{message}</p>}
          <Button className="md:col-span-2 xl:col-span-4" type="submit" disabled={pending || projects.length === 0 || users.length === 0}>
            {pending ? "Creating..." : "Create task"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Picker({
  label,
  value,
  onValueChange,
  items,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
        <SelectContent>
          {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
