"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DiscardChangesDialog } from "@/components/ui/discard-changes-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { projectUpdateSchema } from "@/lib/validators";

type ProjectEditValues = z.infer<typeof projectUpdateSchema>;

export type EditableProject = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  client: string;
  companies: { id: string; name: string; code: string }[];
  startDate: string;
  endDate: string;
  status: ProjectEditValues["status"];
  priority: ProjectEditValues["priority"];
  budget: number;
};

const statuses: NonNullable<ProjectEditValues["status"]>[] = ["DRAFT", "PLANNING", "PREPARATION", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"];
const priorities: NonNullable<ProjectEditValues["priority"]>[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function ProjectEditDialog({ project, companies }: { project: EditableProject; companies: { id: string; name: string; code: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ProjectEditValues>({
    resolver: zodResolver(projectUpdateSchema),
    defaultValues: {
      projectId: project.projectId,
      name: project.name,
      description: project.description,
      client: project.client,
      companyIds: project.companies.map((company) => company.id),
      startDate: new Date(project.startDate),
      endDate: new Date(project.endDate),
      status: project.status,
      priority: project.priority,
      budget: project.budget,
    },
  });
  const selectedCompanyIds = form.watch("companyIds") ?? [];

  function handleOpenChange(next: boolean) {
    if (!next && form.formState.isDirty) {
      setDiscardOpen(true);
    } else {
      setOpen(next);
    }
  }

  function toggleCompany(companyId: string, checked: boolean) {
    const nextCompanyIds = checked
      ? Array.from(new Set([...selectedCompanyIds, companyId]))
      : selectedCompanyIds.filter((id) => id !== companyId);
    form.setValue("companyIds", nextCompanyIds, { shouldDirty: true, shouldValidate: true });
    form.setValue("client", companies.filter((company) => nextCompanyIds.includes(company.id)).map((company) => company.name).join(", "));
  }

  async function onSubmit(values: ProjectEditValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Project update failed.");
        return;
      }

      form.reset(values);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline"><Pencil className="h-4 w-4" /> Edit</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project planning, status, priority, budget, and client details.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
            <Field label="Project ID" id="projectId"><Input id="projectId" {...form.register("projectId")} /></Field>
            <Field label="Project Name" id="name"><Input id="name" {...form.register("name")} /></Field>
            <Field label="Budget" id="budget"><Input id="budget" type="number" {...form.register("budget")} /></Field>
            <Field label="Start Date" id="startDate"><Input id="startDate" type="date" defaultValue={project.startDate.slice(0, 10)} {...form.register("startDate")} /></Field>
            <Field label="End Date" id="endDate"><Input id="endDate" type="date" defaultValue={project.endDate.slice(0, 10)} {...form.register("endDate")} /></Field>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select defaultValue={project.status} onValueChange={(value) => form.setValue("status", value as ProjectEditValues["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select defaultValue={project.priority} onValueChange={(value) => form.setValue("priority", value as ProjectEditValues["priority"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{priorities.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Field className="md:col-span-2" label="Description" id="description"><Input id="description" {...form.register("description")} /></Field>
            <div className="space-y-3 md:col-span-2">
              <Label>Companies</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {companies.map((company) => (
                  <label key={company.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium">
                    <input
                      className="h-4 w-4 shrink-0 rounded border-input"
                      type="checkbox"
                      checked={selectedCompanyIds.includes(company.id)}
                      onChange={(event) => toggleCompany(company.id, event.target.checked)}
                    />
                    <span className="min-w-0 truncate">{company.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{company.code}</span>
                  </label>
                ))}
              </div>
              {form.formState.errors.companyIds && <p className="text-sm text-destructive">{form.formState.errors.companyIds.message}</p>}
            </div>
            {message && <p className="text-sm text-destructive md:col-span-2">{message}</p>}
            <Button className="md:col-span-2" type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
          </form>
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
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
