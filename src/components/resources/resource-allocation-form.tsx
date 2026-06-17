"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resourceAllocationSchema } from "@/lib/validators";

type Values = z.infer<typeof resourceAllocationSchema>;
type Option = { id: string; name: string };

const statuses: Values["status"][] = ["PLANNED", "CONFIRMED", "COMPLETED", "CANCELLED"];

export function ResourceAllocationForm({ users, projects, tasks, maintenances }: { users: Option[]; projects: Option[]; tasks: Option[]; maintenances: Option[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(resourceAllocationSchema),
    defaultValues: {
      userId: users[0]?.id ?? "",
      title: "",
      projectId: "",
      taskId: "",
      maintenanceId: "",
      startAt: new Date(),
      endAt: new Date(),
      allocationPercent: 100,
      status: "PLANNED",
      notes: "",
    },
  });

  async function submit(values: Values) {
    setMessage(null);
    setWarnings([]);
    startTransition(async () => {
      const response = await fetch("/api/resource-allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(body?.error ?? "Resource allocation failed.");
        return;
      }
      setWarnings(body?.warnings ?? []);
      setMessage("Resource allocated.");
      form.reset({ ...values, title: "", notes: "" });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Allocate Resource</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={form.handleSubmit(submit)}>
          <Picker label="Resource" value={form.watch("userId")} onValueChange={(value) => form.setValue("userId", value)} items={users.map((user) => ({ value: user.id, label: user.name }))} />
          <Field label="Allocation Title" id="title"><Input id="title" placeholder="ERP rollout workshop" {...form.register("title")} /></Field>
          <Field label="Start" id="startAt"><Input id="startAt" type="datetime-local" {...form.register("startAt")} /></Field>
          <Field label="End" id="endAt"><Input id="endAt" type="datetime-local" {...form.register("endAt")} /></Field>
          <Picker label="Project" value={form.watch("projectId") ?? ""} onValueChange={(value) => form.setValue("projectId", value)} items={[{ value: "none", label: "No project" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} />
          <Picker label="Task" value={form.watch("taskId") ?? ""} onValueChange={(value) => form.setValue("taskId", value)} items={[{ value: "none", label: "No task" }, ...tasks.map((task) => ({ value: task.id, label: task.name }))]} />
          <Picker label="Maintenance" value={form.watch("maintenanceId") ?? ""} onValueChange={(value) => form.setValue("maintenanceId", value)} items={[{ value: "none", label: "No maintenance" }, ...maintenances.map((maintenance) => ({ value: maintenance.id, label: maintenance.name }))]} />
          <Field label="Allocation %" id="allocationPercent"><Input id="allocationPercent" type="number" min="1" max="100" {...form.register("allocationPercent")} /></Field>
          <Picker label="Status" value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as Values["status"])} items={statuses.map((status) => ({ value: status, label: status.replaceAll("_", " ") }))} />
          <Field label="Notes" id="notes"><Input id="notes" placeholder="Reason, dependency, coverage note" {...form.register("notes")} /></Field>
          {form.formState.errors.projectId && <p className="text-sm text-destructive xl:col-span-4">{form.formState.errors.projectId.message}</p>}
          {form.formState.errors.endAt && <p className="text-sm text-destructive xl:col-span-4">{form.formState.errors.endAt.message}</p>}
          {warnings.length > 0 && <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200 xl:col-span-4">{warnings.map((warning) => <div key={warning}>{warning}</div>)}</div>}
          {message && <p className="text-sm text-muted-foreground xl:col-span-4">{message}</p>}
          <Button className="xl:col-span-4" disabled={pending || users.length === 0}>{pending ? "Allocating..." : "Allocate resource"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function Picker({ label, value, onValueChange, items }: { label: string; value: string; onValueChange: (value: string) => void; items: { value: string; label: string }[] }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || "none"} onValueChange={(next) => onValueChange(next === "none" ? "" : next)}>
        <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
        <SelectContent>{items.map((item) => <SelectItem key={item.value || "none"} value={item.value || "none"}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
