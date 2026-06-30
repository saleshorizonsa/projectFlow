"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DiscardChangesDialog } from "@/components/ui/discard-changes-dialog";
import { itAssetUpdateSchema } from "@/lib/validators";
import type { AssetTableRow } from "@/components/it-maintenance/it-maintenance-tables";

type UpdateValues = z.infer<typeof itAssetUpdateSchema>;
type CompanyOption = { id: string; name: string; code: string };
type UserOption = { id: string; name: string };
type EmployeeOption = { id: string; name: string; employeeId: string };

const ASSET_TYPES = ["SERVER", "ROUTER", "SWITCH", "FIREWALL", "STORAGE", "LAPTOP", "DESKTOP", "PRINTER", "APPLICATION", "DATABASE", "CLOUD_SERVICE", "OTHER"] as const;
const ASSET_STATUSES = ["ACTIVE", "MAINTENANCE", "RETIRED", "PLANNED_REPLACEMENT"] as const;

type Props = {
  asset: AssetTableRow;
  companies: CompanyOption[];
  users: UserOption[];
  employees: EmployeeOption[];
};

export function AssetEditDialog({ asset, companies, users, employees }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<UpdateValues>({
    resolver: zodResolver(itAssetUpdateSchema),
    defaultValues: {
      assetTag: asset.assetTag,
      name: asset.name,
      type: asset.type as UpdateValues["type"],
      vendor: asset.vendor,
      model: asset.model,
      location: asset.location,
      purchaseDate: new Date(asset.purchaseDate),
      lifecycleYears: asset.lifecycleYears,
      status: asset.status as UpdateValues["status"],
      assignedToId: asset.assignedToId ?? "none",
      employeeId: asset.employeeId ?? "none",
      notes: asset.notes ?? "",
      companyIds: asset.companies.map((c) => c.company.id),
    },
  });

  const selectedCompanyIds = form.watch("companyIds") ?? [];

  function toggleCompany(companyId: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...selectedCompanyIds, companyId]))
      : selectedCompanyIds.filter((id) => id !== companyId);
    form.setValue("companyIds", next, { shouldDirty: true });
  }

  function handleOpenChange(next: boolean) {
    if (!next && form.formState.isDirty) {
      setDiscardOpen(true);
    } else {
      if (!next) form.reset();
      setOpen(next);
    }
  }

  function onSubmit(values: UpdateValues) {
    setServerError(null);
    startTransition(async () => {
      const res = await fetch(`/api/it-assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setServerError(body?.error ?? "Failed to save changes.");
        return;
      }
      form.reset(values);
      setOpen(false);
      router.refresh();
    });
  }

  const purchaseDateValue = form.watch("purchaseDate");
  const purchaseDateStr = purchaseDateValue
    ? new Date(purchaseDateValue).toISOString().split("T")[0]
    : "";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button size="icon" variant="ghost" title="Edit asset">
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Asset — {asset.assetTag}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
            <Field label="Asset Tag" id="assetTag" error={form.formState.errors.assetTag?.message}>
              <Input id="assetTag" {...form.register("assetTag")} />
            </Field>
            <Field label="Name" id="name" error={form.formState.errors.name?.message}>
              <Input id="name" {...form.register("name")} />
            </Field>

            {/* Companies */}
            <div className="space-y-2 md:col-span-2">
              <Label>Companies</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {companies.map((company) => (
                  <label key={company.id} className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-input"
                      checked={selectedCompanyIds.includes(company.id)}
                      onChange={(e) => toggleCompany(company.id, e.target.checked)}
                    />
                    <span className="min-w-0 truncate">{company.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{company.code}</span>
                  </label>
                ))}
              </div>
            </div>

            <Picker label="Type" value={form.watch("type") ?? "SERVER"} onValueChange={(v) => form.setValue("type", v as UpdateValues["type"], { shouldDirty: true })} items={ASSET_TYPES.map((t) => ({ value: t, label: t.replaceAll("_", " ") }))} />
            <Picker label="Status" value={form.watch("status") ?? "ACTIVE"} onValueChange={(v) => form.setValue("status", v as UpdateValues["status"], { shouldDirty: true })} items={ASSET_STATUSES.map((s) => ({ value: s, label: s.replaceAll("_", " ") }))} />
            <Picker label="Assigned User" value={form.watch("assignedToId") ?? "none"} onValueChange={(v) => form.setValue("assignedToId", v, { shouldDirty: true })} items={[{ value: "none", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))]} />
            <Picker label="Employee Custodian" value={form.watch("employeeId") ?? "none"} onValueChange={(v) => form.setValue("employeeId", v, { shouldDirty: true })} items={[{ value: "none", label: "Unassigned" }, ...employees.map((e) => ({ value: e.id, label: `${e.employeeId} / ${e.name}` }))]} />

            <Field label="Vendor" id="vendor"><Input id="vendor" {...form.register("vendor")} /></Field>
            <Field label="Model / Version" id="model"><Input id="model" {...form.register("model")} /></Field>
            <Field label="Location" id="location"><Input id="location" {...form.register("location")} /></Field>
            <Field label="Purchase / Go-live Date" id="purchaseDate">
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDateStr}
                onChange={(e) => form.setValue("purchaseDate", new Date(e.target.value), { shouldDirty: true })}
              />
            </Field>
            <Field label="Lifecycle Years" id="lifecycleYears">
              <Input id="lifecycleYears" type="number" min={1} max={20} {...form.register("lifecycleYears")} />
            </Field>
            <Field label="Notes" id="notes" className="md:col-span-2">
              <Input id="notes" placeholder="Warranty, support contract, dependencies..." {...form.register("notes")} />
            </Field>

            {serverError && <p className="text-sm text-destructive md:col-span-2">{serverError}</p>}
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={pending || !form.formState.isDirty}>
                {pending ? "Saving…" : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
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

function Field({ label, id, error, children, className }: { label: string; id: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Picker({ label, value, onValueChange, items }: { label: string; value: string; onValueChange: (v: string) => void; items: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
