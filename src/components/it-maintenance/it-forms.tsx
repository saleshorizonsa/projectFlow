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
import { itAssetSchema, itLicenseSchema, itMaintenanceSchema } from "@/lib/validators";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";

type AssetValues = z.infer<typeof itAssetSchema>;
type MaintenanceValues = z.infer<typeof itMaintenanceSchema>;
type LicenseValues = z.infer<typeof itLicenseSchema>;
type AssetOption = { id: string; name: string; assetTag: string };
type UserOption = { id: string; name: string };
type CompanyOption = { id: string; name: string; code: string };
type EmployeeOption = { id: string; name: string; employeeId: string };

const assetTypes: AssetValues["type"][] = ["SERVER", "ROUTER", "SWITCH", "FIREWALL", "STORAGE", "LAPTOP", "DESKTOP", "PRINTER", "APPLICATION", "DATABASE", "CLOUD_SERVICE", "OTHER"];
const assetStatuses: AssetValues["status"][] = ["ACTIVE", "MAINTENANCE", "RETIRED", "PLANNED_REPLACEMENT"];
const maintenanceStatuses: MaintenanceValues["status"][] = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export function ITAssetForm({ companies, users, employees }: { companies: CompanyOption[]; users: UserOption[]; employees: EmployeeOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<AssetValues>({
    resolver: zodResolver(itAssetSchema),
    defaultValues: {
      assetTag: "",
      name: "",
      companyIds: [],
      type: "SERVER",
      vendor: "",
      model: "",
      location: "",
      purchaseDate: new Date(),
      lifecycleYears: 5,
      status: "ACTIVE",
      assignedToId: "",
      employeeId: "",
      notes: "",
    },
  });
  useUnsavedChangesWarning(form.formState.isDirty);
  const selectedCompanyIds = form.watch("companyIds") ?? [];

  function toggleCompany(companyId: string, checked: boolean) {
    const nextCompanyIds = checked
      ? Array.from(new Set([...selectedCompanyIds, companyId]))
      : selectedCompanyIds.filter((id) => id !== companyId);
    form.setValue("companyIds", nextCompanyIds, { shouldDirty: true, shouldValidate: true });
  }

  async function onSubmit(values: AssetValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/it-assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Asset could not be created.");
        return;
      }
      setMessage("Asset added.");
      form.reset({ assetTag: "", name: "", companyIds: [], type: "SERVER", vendor: "", model: "", location: "", purchaseDate: new Date(), lifecycleYears: 5, status: "ACTIVE", assignedToId: "", employeeId: "", notes: "" });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Add Asset / Application</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field label="Asset Tag" id="assetTag"><Input id="assetTag" placeholder="SRV-001" {...form.register("assetTag")} /></Field>
          <Field label="Name" id="name"><Input id="name" placeholder="ERP Database Server" {...form.register("name")} /></Field>
          <div className="space-y-3 md:col-span-2 xl:col-span-4">
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
            {companies.length === 0 && <p className="text-sm text-destructive">Create group companies before adding IT assets.</p>}
            {form.formState.errors.companyIds && <p className="text-sm text-destructive">{form.formState.errors.companyIds.message}</p>}
          </div>
          <Picker label="Type" value={form.watch("type")} onValueChange={(value) => form.setValue("type", value as AssetValues["type"])} items={assetTypes.map((value) => ({ value, label: value.replaceAll("_", " ") }))} />
          <Picker label="Status" value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as AssetValues["status"])} items={assetStatuses.map((value) => ({ value, label: value.replaceAll("_", " ") }))} />
          <Picker label="Assigned User" value={form.watch("assignedToId") ?? ""} onValueChange={(value) => form.setValue("assignedToId", value)} items={[{ value: "none", label: "Unassigned" }, ...users.map((user) => ({ value: user.id, label: user.name }))]} />
          <Picker label="Employee Custodian" value={form.watch("employeeId") ?? ""} onValueChange={(value) => form.setValue("employeeId", value)} items={[{ value: "none", label: "Unassigned" }, ...employees.map((employee) => ({ value: employee.id, label: `${employee.employeeId} / ${employee.name}` }))]} />
          <Field label="Vendor" id="vendor"><Input id="vendor" placeholder="Dell / Cisco / Microsoft" {...form.register("vendor")} /></Field>
          <Field label="Model / Version" id="model"><Input id="model" placeholder="PowerEdge R740 / IOS 17" {...form.register("model")} /></Field>
          <Field label="Location" id="location"><Input id="location" placeholder="Server Room / Cloud" {...form.register("location")} /></Field>
          <Field label="Purchase / Go-live Date" id="purchaseDate"><Input id="purchaseDate" type="date" {...form.register("purchaseDate")} /></Field>
          <Field label="Lifecycle Years" id="lifecycleYears"><Input id="lifecycleYears" type="number" min="1" max="20" {...form.register("lifecycleYears")} /></Field>
          <Field className="md:col-span-2 xl:col-span-3" label="Notes" id="notes"><Input id="notes" placeholder="Warranty, support contract, dependency, owner" {...form.register("notes")} /></Field>
          {message && <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-4">{message}</p>}
          <Button className="md:col-span-2 xl:col-span-4" disabled={pending || companies.length === 0}>{pending ? "Adding..." : "Add asset"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ITMaintenanceForm({ assets, users }: { assets: AssetOption[]; users: UserOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<MaintenanceValues>({
    resolver: zodResolver(itMaintenanceSchema),
    defaultValues: {
      maintenanceId: "",
      title: "",
      description: "",
      assetId: assets[0]?.id ?? "",
      scheduledAt: new Date(),
      durationMinutes: 60,
      status: "PLANNED",
      responsibleId: users[0]?.id ?? "",
      downtimeRequired: false,
    },
  });
  useUnsavedChangesWarning(form.formState.isDirty);

  async function onSubmit(values: MaintenanceValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/it-maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Maintenance could not be created.");
        return;
      }
      setMessage("Maintenance plan added.");
      form.reset({ ...values, maintenanceId: "", title: "", description: "", durationMinutes: 60, status: "PLANNED", downtimeRequired: false });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Plan Maintenance</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={form.handleSubmit(onSubmit)}>
          {assets.length === 0 && <p className="text-sm text-destructive md:col-span-2 xl:col-span-4">Add an asset first before planning maintenance.</p>}
          <Field label="Maintenance ID" id="maintenanceId"><Input id="maintenanceId" placeholder="MNT-001" {...form.register("maintenanceId")} /></Field>
          <Field label="Title" id="title"><Input id="title" placeholder="Firmware upgrade" {...form.register("title")} /></Field>
          <Picker label="Asset" value={form.watch("assetId")} onValueChange={(value) => form.setValue("assetId", value)} items={assets.map((asset) => ({ value: asset.id, label: `${asset.assetTag} / ${asset.name}` }))} />
          <Picker label="Responsible" value={form.watch("responsibleId")} onValueChange={(value) => form.setValue("responsibleId", value)} items={users.map((user) => ({ value: user.id, label: user.name }))} />
          <Field className="md:col-span-2" label="Description" id="description"><Input id="description" {...form.register("description")} /></Field>
          <Field label="Date & Time" id="scheduledAt"><Input id="scheduledAt" type="datetime-local" {...form.register("scheduledAt")} /></Field>
          <Field label="Duration Minutes" id="durationMinutes"><Input id="durationMinutes" type="number" min="15" step="15" {...form.register("durationMinutes")} /></Field>
          <Picker label="Status" value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as MaintenanceValues["status"])} items={maintenanceStatuses.map((value) => ({ value, label: value.replaceAll("_", " ") }))} />
          <Picker label="Downtime Required" value={String(form.watch("downtimeRequired"))} onValueChange={(value) => form.setValue("downtimeRequired", value === "true")} items={[{ value: "false", label: "No" }, { value: "true", label: "Yes" }]} />
          {message && <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-4">{message}</p>}
          <Button className="md:col-span-2 xl:col-span-4" disabled={pending || assets.length === 0 || users.length === 0}>{pending ? "Planning..." : "Plan maintenance"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ITLicenseForm({ assets }: { assets: AssetOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<LicenseValues>({
    resolver: zodResolver(itLicenseSchema),
    defaultValues: {
      licenseId: "",
      name: "",
      vendor: "",
      assetId: "",
      seats: 1,
      cost: 0,
      expiryDate: "" as unknown as Date,
      owner: "",
      notes: "",
    },
  });
  useUnsavedChangesWarning(form.formState.isDirty);

  async function onSubmit(values: LicenseValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/it-licenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "License could not be created.");
        return;
      }
      setMessage("License added.");
      form.reset({ licenseId: "", name: "", vendor: "", assetId: values.assetId, seats: 1, cost: 0, expiryDate: "" as unknown as Date, owner: "", notes: "" });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Add License / Subscription</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Field label="License ID" id="licenseId"><Input id="licenseId" placeholder="LIC-001" {...form.register("licenseId")} /></Field>
          <Field label="Name" id="licenseName"><Input id="licenseName" placeholder="Windows Server CAL" {...form.register("name")} /></Field>
          <Field label="Vendor" id="licenseVendor"><Input id="licenseVendor" placeholder="Microsoft / Fortinet" {...form.register("vendor")} /></Field>
          <Picker label="Linked Asset" value={form.watch("assetId") ?? ""} onValueChange={(value) => form.setValue("assetId", value)} items={[{ value: "none", label: "No asset" }, ...assets.map((asset) => ({ value: asset.id, label: `${asset.assetTag} / ${asset.name}` }))]} />
          <Field label="Seats / Qty" id="seats"><Input id="seats" type="number" min="1" {...form.register("seats")} /></Field>
          <Field label="Cost" id="cost"><Input id="cost" type="number" min="0" step="0.01" {...form.register("cost")} /></Field>
          <Field label="Expiry Date" id="expiryDate"><Input id="expiryDate" type="date" {...form.register("expiryDate")} /></Field>
          <Field label="Owner" id="owner"><Input id="owner" placeholder="IT / Finance / Business owner" {...form.register("owner")} /></Field>
          <Field className="md:col-span-2 xl:col-span-3" label="Notes" id="licenseNotes"><Input id="licenseNotes" placeholder="Renewal terms, PO, support contact" {...form.register("notes")} /></Field>
          {message && <p className="text-sm text-muted-foreground md:col-span-2 xl:col-span-4">{message}</p>}
          <Button className="md:col-span-2 xl:col-span-4" disabled={pending}>{pending ? "Adding..." : "Add license"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, id, className, children }: { label: string; id: string; className?: string; children: React.ReactNode }) {
  return <div className={className ? `space-y-2 ${className}` : "space-y-2"}><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function Picker({ label, value, onValueChange, items }: { label: string; value: string; onValueChange: (value: string) => void; items: { value: string; label: string }[] }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value === "none" ? "" : value} onValueChange={(next) => onValueChange(next === "none" ? "" : next)}>
        <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
        <SelectContent>{items.map((item) => <SelectItem key={item.value || "none"} value={item.value || "none"}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
