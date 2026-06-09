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
import { employeeSchema } from "@/lib/validators";

type EmployeeValues = z.infer<typeof employeeSchema>;
type CompanyOption = { id: string; name: string; code: string };
const statuses: EmployeeValues["status"][] = ["ACTIVE", "INACTIVE", "EXITED"];

export function EmployeeForm({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<EmployeeValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employeeId: "",
      name: "",
      email: "",
      phone: "",
      department: "",
      jobTitle: "",
      location: "",
      status: "ACTIVE",
      companyIds: [],
    },
  });
  const selectedCompanyIds = form.watch("companyIds") ?? [];

  function toggleCompany(companyId: string, checked: boolean) {
    const nextCompanyIds = checked ? Array.from(new Set([...selectedCompanyIds, companyId])) : selectedCompanyIds.filter((id) => id !== companyId);
    form.setValue("companyIds", nextCompanyIds, { shouldDirty: true, shouldValidate: true });
  }

  async function onSubmit(values: EmployeeValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Employee could not be created.");
        return;
      }
      form.reset({ employeeId: "", name: "", email: "", phone: "", department: "", jobTitle: "", location: "", status: "ACTIVE", companyIds: [] });
      setMessage("Employee created. You can now assign assets and licenses from IT Maintenance.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create Employee</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field label="Employee ID" id="employeeId"><Input id="employeeId" placeholder="EMP-001" {...form.register("employeeId")} /></Field>
          <Field label="Name" id="name"><Input id="name" {...form.register("name")} /></Field>
          <Field label="Email" id="email"><Input id="email" type="email" {...form.register("email")} /></Field>
          <Field label="Phone" id="phone"><Input id="phone" {...form.register("phone")} /></Field>
          <Field label="Department" id="department"><Input id="department" placeholder="IT / Finance / Operations" {...form.register("department")} /></Field>
          <Field label="Job Title" id="jobTitle"><Input id="jobTitle" {...form.register("jobTitle")} /></Field>
          <Field label="Location" id="location"><Input id="location" placeholder="Head Office / Plant / Branch" {...form.register("location")} /></Field>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as EmployeeValues["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-3 md:col-span-2 xl:col-span-4">
            <Label>Companies</Label>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {companies.map((company) => (
                <label key={company.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium">
                  <input className="h-4 w-4 shrink-0 rounded border-input" type="checkbox" checked={selectedCompanyIds.includes(company.id)} onChange={(event) => toggleCompany(company.id, event.target.checked)} />
                  <span className="min-w-0 truncate">{company.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{company.code}</span>
                </label>
              ))}
            </div>
            {form.formState.errors.companyIds && <p className="text-sm text-destructive">{form.formState.errors.companyIds.message}</p>}
          </div>
          {message && <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-4">{message}</p>}
          <Button className="md:col-span-2 xl:col-span-4" disabled={pending || companies.length === 0}>{pending ? "Creating..." : "Create employee"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
