"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DiscardChangesDialog } from "@/components/ui/discard-changes-dialog";

type AssetOption = { id: string; name: string; assetTag: string };
type EmployeeOption = { id: string; name: string; employeeId: string };
type LicenseRow = {
  id: string;
  licenseId: string;
  name: string;
  vendor: string;
  assetId: string | null;
  seats: number;
  cost: number;
  expiryDate: string;
  owner: string;
  employeeId: string | null;
  notes: string | null;
};

export function LicenseActions({ license, assets, employees }: { license: LicenseRow; assets: AssetOption[]; employees: EmployeeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [assetId, setAssetId] = useState(license.assetId ?? "");
  const [employeeId, setEmployeeId] = useState(license.employeeId ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const markDirty = () => setIsDirty(true);

  function handleOpenChange(next: boolean) {
    if (!next && isDirty) { setDiscardOpen(true); } else { setOpen(next); }
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/it-licenses/${license.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseId: formData.get("licenseId"),
          name: formData.get("name"),
          vendor: formData.get("vendor"),
          assetId,
          seats: formData.get("seats"),
          cost: formData.get("cost"),
          expiryDate: formData.get("expiryDate"),
          owner: formData.get("owner"),
          employeeId,
          notes: formData.get("notes"),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "License update failed.");
        return;
      }
      setOpen(false);
      setIsDirty(false);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`Delete license "${license.name}"?`)) return;
    startTransition(async () => {
      const response = await fetch(`/api/it-licenses/${license.id}`, { method: "DELETE" });
      if (!response.ok) {
        setMessage("License delete failed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild><Button size="sm" variant="outline"><Pencil className="h-4 w-4" /> Edit</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit License</DialogTitle>
            <DialogDescription>Admin-only license renewal and assignment changes.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
            <Field label="License ID" id="licenseId"><Input id="licenseId" name="licenseId" defaultValue={license.licenseId} onChange={markDirty} /></Field>
            <Field label="Name" id="name"><Input id="name" name="name" defaultValue={license.name} onChange={markDirty} /></Field>
            <Field label="Vendor" id="vendor"><Input id="vendor" name="vendor" defaultValue={license.vendor} onChange={markDirty} /></Field>
            <Field label="Seats / Qty" id="seats"><Input id="seats" name="seats" type="number" min="1" defaultValue={license.seats} onChange={markDirty} /></Field>
            <Field label="Cost" id="cost"><Input id="cost" name="cost" type="number" min="0" step="0.01" defaultValue={license.cost} onChange={markDirty} /></Field>
            <Field label="Expiry Date" id="expiryDate"><Input id="expiryDate" name="expiryDate" type="date" defaultValue={license.expiryDate.slice(0, 10)} onChange={markDirty} /></Field>
            <Field label="Owner" id="owner"><Input id="owner" name="owner" defaultValue={license.owner} onChange={markDirty} /></Field>
            <Picker label="Linked Asset" value={assetId} onValueChange={(v) => { setAssetId(v); setIsDirty(true); }} items={[{ value: "none", label: "No asset" }, ...assets.map((asset) => ({ value: asset.id, label: `${asset.assetTag} / ${asset.name}` }))]} />
            <Picker label="Employee Assignee" value={employeeId} onValueChange={(v) => { setEmployeeId(v); setIsDirty(true); }} items={[{ value: "none", label: "Unassigned" }, ...employees.map((employee) => ({ value: employee.id, label: `${employee.employeeId} / ${employee.name}` }))]} />
            <Field label="Notes" id="notes"><Input id="notes" name="notes" defaultValue={license.notes ?? ""} onChange={markDirty} /></Field>
            {message && <p className="text-sm text-destructive md:col-span-2">{message}</p>}
            <Button className="md:col-span-2" disabled={pending}>{pending ? "Saving..." : "Save license"}</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Button size="icon" variant="ghost" onClick={remove} disabled={pending} aria-label="Delete license"><Trash2 className="h-4 w-4" /></Button>
      <DiscardChangesDialog open={discardOpen} onKeep={() => setDiscardOpen(false)} onDiscard={() => { setDiscardOpen(false); setIsDirty(false); setOpen(false); }} />
    </div>
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
