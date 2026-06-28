"use client";

import Link from "next/link";
import { Eye, EyeOff, FileText, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEnum } from "@/lib/utils";
import { DiscardChangesDialog } from "@/components/ui/discard-changes-dialog";

type CompanyOption = { id: string; name: string; code: string };
type EmployeeRow = {
  id: string;
  employeeId: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string;
  jobTitle: string;
  location: string | null;
  status: string;
  ipAddress: string | null;
  vpnUserId: string | null;
  vpnPassword: string | null;
  companies: CompanyOption[];
  assets: { id: string; assetTag: string; name: string; type: string }[];
  licenses: { id: string; licenseId: string; name: string; vendor: string }[];
};

const statuses = ["ACTIVE", "INACTIVE", "EXITED"];

export function EmployeeTable({ employees, companies, canManage }: { employees: EmployeeRow[]; companies: CompanyOption[]; canManage: boolean }) {
  const router = useRouter();

  async function deleteEmployee(employee: EmployeeRow) {
    if (!window.confirm(`Delete employee "${employee.name}"? Assigned assets and licenses will be unlinked.`)) return;
    const response = await fetch(`/api/employees/${employee.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null);
    if (!response.ok) window.alert(body?.error ?? "Employee delete failed.");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="hidden max-h-[560px] overflow-auto rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Companies</TableHead>
                <TableHead>Role / Location</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead>Licenses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="font-medium">{employee.employeeId} / {employee.name}</div>
                    <div className="text-xs text-muted-foreground">{employee.email ?? "No email"} / {employee.phone ?? "No phone"}</div>
                  </TableCell>
                  <TableCell><CompanyBadges companies={employee.companies} /></TableCell>
                  <TableCell>
                    <div>{employee.jobTitle}</div>
                    <div className="text-xs text-muted-foreground">{employee.department} / {employee.location ?? "No location"}</div>
                  </TableCell>
                  <TableCell><Badge variant={employee.assets.length ? "secondary" : "outline"}>{employee.assets.length}</Badge></TableCell>
                  <TableCell><Badge variant={employee.licenses.length ? "secondary" : "outline"}>{employee.licenses.length}</Badge></TableCell>
                  <TableCell><Badge variant={employee.status === "ACTIVE" ? "success" : "secondary"}>{formatEnum(employee.status)}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="outline"><Link href={`/employees/${employee.id}/asset-report`}><FileText className="h-4 w-4" /> Report</Link></Button>
                      {canManage && <EmployeeEditDialog employee={employee} companies={companies} />}
                      {canManage && <Button size="icon" variant="ghost" onClick={() => deleteEmployee(employee)} aria-label="Delete employee"><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid max-h-[620px] gap-3 overflow-auto pr-1 md:hidden">
          {employees.map((employee) => (
            <div key={employee.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{employee.employeeId} / {employee.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{employee.jobTitle} / {employee.department}</div>
                </div>
                <Badge className="shrink-0" variant={employee.status === "ACTIVE" ? "success" : "secondary"}>{formatEnum(employee.status)}</Badge>
              </div>
              <div className="mt-3"><CompanyBadges companies={employee.companies} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs text-muted-foreground">
                <div><div className="text-base font-semibold text-foreground">{employee.assets.length}</div>Assets</div>
                <div><div className="text-base font-semibold text-foreground">{employee.licenses.length}</div>Licenses</div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button asChild size="sm" variant="outline"><Link href={`/employees/${employee.id}/asset-report`}><FileText className="h-4 w-4" /> Report</Link></Button>
                {canManage && <EmployeeEditDialog employee={employee} companies={companies} />}
                {canManage && <Button size="sm" variant="outline" onClick={() => deleteEmployee(employee)}><Trash2 className="h-4 w-4" /> Delete</Button>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeEditDialog({ employee, companies }: { employee: EmployeeRow; companies: CompanyOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(employee.status);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(employee.companies.map((company) => company.id));
  const [showVpnPassword, setShowVpnPassword] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const markDirty = () => setIsDirty(true);

  function toggleCompany(companyId: string, checked: boolean) {
    setSelectedCompanyIds((current) => checked ? Array.from(new Set([...current, companyId])) : current.filter((id) => id !== companyId));
  }

  function handleOpenChange(next: boolean) {
    if (!next && isDirty) { setDiscardOpen(true); } else { setOpen(next); }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    const newVpnPassword = (formData.get("vpnPassword") as string).trim();
    startTransition(async () => {
      const payload: Record<string, unknown> = {
        employeeId: formData.get("employeeId"),
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        department: formData.get("department"),
        jobTitle: formData.get("jobTitle"),
        location: formData.get("location"),
        ipAddress: formData.get("ipAddress"),
        vpnUserId: formData.get("vpnUserId"),
        status,
        companyIds: selectedCompanyIds,
      };
      if (newVpnPassword) payload.vpnPassword = newVpnPassword;
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Employee update failed.");
        return;
      }
      setOpen(false);
      setIsDirty(false);
      router.refresh();
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild><Button size="sm" variant="outline"><Pencil className="h-4 w-4" /> Edit</Button></DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee details and company assignment.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <Field label="Employee ID" id="employeeId"><Input id="employeeId" name="employeeId" defaultValue={employee.employeeId} onChange={markDirty} /></Field>
            <Field label="Name" id="name"><Input id="name" name="name" defaultValue={employee.name} onChange={markDirty} /></Field>
            <Field label="Email" id="email"><Input id="email" name="email" type="email" defaultValue={employee.email ?? ""} onChange={markDirty} /></Field>
            <Field label="Phone" id="phone"><Input id="phone" name="phone" defaultValue={employee.phone ?? ""} onChange={markDirty} /></Field>
            <Field label="Department" id="department"><Input id="department" name="department" defaultValue={employee.department} onChange={markDirty} /></Field>
            <Field label="Job Title" id="jobTitle"><Input id="jobTitle" name="jobTitle" defaultValue={employee.jobTitle} onChange={markDirty} /></Field>
            <Field label="Location" id="location"><Input id="location" name="location" defaultValue={employee.location ?? ""} onChange={markDirty} /></Field>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v); setIsDirty(true); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{formatEnum(item)}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <p className="text-sm font-semibold text-muted-foreground">Network / VPN Access</p>
            </div>
            <Field label="IP Address" id="ipAddress"><Input id="ipAddress" name="ipAddress" placeholder="192.168.1.x" defaultValue={employee.ipAddress ?? ""} onChange={markDirty} /></Field>
            <Field label="VPN User ID" id="vpnUserId"><Input id="vpnUserId" name="vpnUserId" defaultValue={employee.vpnUserId ?? ""} onChange={markDirty} /></Field>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="vpnPassword">VPN Password</Label>
              <div className="relative">
                <Input id="vpnPassword" name="vpnPassword" type={showVpnPassword ? "text" : "password"} placeholder={employee.vpnPassword ? "Leave blank to keep current" : "Set VPN password"} className="pr-10" onChange={markDirty} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowVpnPassword((v) => !v)} aria-label={showVpnPassword ? "Hide password" : "Show password"}>
                  {showVpnPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-3 md:col-span-2">
              <Label>Companies</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {companies.map((company) => (
                  <label key={company.id} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium">
                    <input className="h-4 w-4 shrink-0 rounded border-input" type="checkbox" checked={selectedCompanyIds.includes(company.id)} onChange={(event) => { toggleCompany(company.id, event.target.checked); setIsDirty(true); }} />
                    <span className="min-w-0 truncate">{company.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{company.code}</span>
                  </label>
                ))}
              </div>
            </div>
            {message && <p className="text-sm text-destructive md:col-span-2">{message}</p>}
            <Button className="md:col-span-2" disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>
      <DiscardChangesDialog open={discardOpen} onKeep={() => setDiscardOpen(false)} onDiscard={() => { setDiscardOpen(false); setIsDirty(false); setOpen(false); }} />
    </>
  );
}

function CompanyBadges({ companies }: { companies: CompanyOption[] }) {
  return (
    <div className="flex max-w-72 flex-wrap gap-1">
      {companies.map((company) => <Badge key={company.id} variant="outline">{company.code}</Badge>)}
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
