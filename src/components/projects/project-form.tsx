"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { projectSchema } from "@/lib/validators";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProjectFormValues = z.infer<typeof projectSchema>;
type CompanyOption = { id: string; name: string; code: string };

export function ProjectForm({ managerId, companies }: { managerId: string; companies: CompanyOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      projectId: "",
      name: "",
      description: "",
      client: "",
      companyIds: [],
      status: "PLANNING",
      priority: "MEDIUM",
      budget: 0,
      managerId,
      startDate: new Date(),
      endDate: new Date(),
    },
  });
  useUnsavedChangesWarning(form.formState.isDirty);
  const selectedCompanyIds = form.watch("companyIds") ?? [];

  function toggleCompany(companyId: string, checked: boolean) {
    const nextCompanyIds = checked
      ? Array.from(new Set([...selectedCompanyIds, companyId]))
      : selectedCompanyIds.filter((id) => id !== companyId);
    form.setValue("companyIds", nextCompanyIds, { shouldDirty: true, shouldValidate: true });
    form.setValue("client", companies.filter((company) => nextCompanyIds.includes(company.id)).map((company) => company.name).join(", "));
  }

  async function onSubmit(values: ProjectFormValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Project could not be created.");
        return;
      }

      form.reset({
        projectId: "",
        name: "",
        description: "",
        client: "",
        status: "PLANNING",
        priority: "MEDIUM",
        budget: 0,
        managerId,
        companyIds: [],
        startDate: new Date(),
        endDate: new Date(),
      });
      setMessage("Project created and synchronized.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create Project & Current State Shell</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          {[
            ["projectId", "Project ID"],
            ["name", "Project Name"],
            ["budget", "Budget"],
            ["startDate", "Start Date"],
            ["endDate", "End Date"],
          ].map(([name, label]) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={name}>{label}</Label>
              <Input id={name} type={name.includes("Date") ? "date" : name === "budget" ? "number" : "text"} {...form.register(name as keyof ProjectFormValues)} />
            </div>
          ))}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...form.register("description")} />
          </div>
          <div className="space-y-3 md:col-span-2">
            <Label>Companies</Label>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
            {companies.length === 0 && <p className="text-sm text-destructive">Create group companies before creating projects.</p>}
            {form.formState.errors.companyIds && <p className="text-sm text-destructive">{form.formState.errors.companyIds.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select defaultValue="PLANNING" onValueChange={(value) => form.setValue("status", value as ProjectFormValues["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["DRAFT", "PLANNING", "PREPARATION", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"].map((status) => (
                  <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select defaultValue="MEDIUM" onValueChange={(value) => form.setValue("priority", value as ProjectFormValues["priority"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((priority) => (
                  <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {message && <p className="text-sm text-muted-foreground md:col-span-2">{message}</p>}
          <Button className="md:col-span-2" type="submit" disabled={pending || companies.length === 0}>{pending ? "Creating..." : "Create project"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
