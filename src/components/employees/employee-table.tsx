"use client";

import Link from "next/link";
import { Eye, EyeOff, FileText, Link2, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEnum } from "@/lib/utils";

type CompanyOption = { id: string; name: string; code: string };
type AssetItem = { id: string; assetTag: string; name: string; type: string };
type LicenseItem = { id: string; licenseId: string; name: string; vendor: string };
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
  assets: AssetItem[];
  licenses: LicenseItem[];
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
                      {canManage && <EmployeeAssignDialog employee={employee} />}
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
                {canManage && <EmployeeAssignDialog employee={employee} />}
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

// ── Assign Assets & Licenses Dialog ─────────────────────────────────────────

type ApiAsset = AssetItem & { employeeId: string | null };
type ApiLicense = LicenseItem & { employeeId: string | null };

function EmployeeAssignDialog({ employee }: { employee: EmployeeRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [assignedAssets, setAssignedAssets] = useState<AssetItem[]>(employee.assets);
  const [assignedLicenses, setAssignedLicenses] = useState<LicenseItem[]>(employee.licenses);
  const [availableAssets, setAvailableAssets] = useState<AssetItem[]>([]);
  const [availableLicenses, setAvailableLicenses] = useState<LicenseItem[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedLicenseId, setSelectedLicenseId] = useState("");

  useEffect(() => {
    if (!open) return;
    setAssignedAssets(employee.assets);
    setAssignedLicenses(employee.licenses);
    setMessage(null);
    setSelectedAssetId("");
    setSelectedLicenseId("");
    setLoading(true);
    Promise.all([
      fetch("/api/it-assets").then((r) => r.json()),
      fetch("/api/it-licenses").then((r) => r.json()),
    ])
      .then(([assets, licenses]: [ApiAsset[], ApiLicense[]]) => {
        setAvailableAssets(assets.filter((a) => !a.employeeId));
        setAvailableLicenses(licenses.filter((l) => !l.employeeId));
      })
      .catch(() => setMessage("Failed to load available items."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee.id]);

  function linkAsset(assetId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/it-assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id }),
      });
      if (!res.ok) { setMessage((await res.json().catch(() => null))?.error ?? "Failed to link asset."); return; }
      const item = availableAssets.find((a) => a.id === assetId);
      if (item) {
        setAssignedAssets((prev) => [...prev, item]);
        setAvailableAssets((prev) => prev.filter((a) => a.id !== assetId));
      }
      setSelectedAssetId("");
      setMessage(null);
      router.refresh();
    });
  }

  function unlinkAsset(assetId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/it-assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: "" }),
      });
      if (!res.ok) { setMessage("Failed to unlink asset."); return; }
      const item = assignedAssets.find((a) => a.id === assetId);
      if (item) {
        setAvailableAssets((prev) => [...prev, item]);
        setAssignedAssets((prev) => prev.filter((a) => a.id !== assetId));
      }
      setMessage(null);
      router.refresh();
    });
  }

  function linkLicense(licenseId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/it-licenses/${licenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id }),
      });
      if (!res.ok) { setMessage((await res.json().catch(() => null))?.error ?? "Failed to link license."); return; }
      const item = availableLicenses.find((l) => l.id === licenseId);
      if (item) {
        setAssignedLicenses((prev) => [...prev, item]);
        setAvailableLicenses((prev) => prev.filter((l) => l.id !== licenseId));
      }
      setSelectedLicenseId("");
      setMessage(null);
      router.refresh();
    });
  }

  function unlinkLicense(licenseId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/it-licenses/${licenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: "" }),
      });
      if (!res.ok) { setMessage("Failed to unlink license."); return; }
      const item = assignedLicenses.find((l) => l.id === licenseId);
      if (item) {
        setAvailableLicenses((prev) => [...prev, item]);
        setAssignedLicenses((prev) => prev.filter((l) => l.id !== licenseId));
      }
      setMessage(null);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label="Assign assets and licenses">
          <Link2 className="h-4 w-4" /> Assign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Assets &amp; Licenses</DialogTitle>
          <DialogDescription>{employee.employeeId} / {employee.name}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading available items…</p>
        ) : (
          <div className="space-y-6">

            {/* ── Assets ── */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Assets</p>
              {assignedAssets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assets assigned.</p>
              ) : (
                <div className="space-y-1">
                  {assignedAssets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-medium">{asset.assetTag}</span>
                        <span className="truncate text-muted-foreground">{asset.name}</span>
                        <Badge variant="secondary" className="shrink-0 text-xs">{formatEnum(asset.type)}</Badge>
                      </div>
                      <Button size="icon" variant="ghost" className="ml-2 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => unlinkAsset(asset.id)} aria-label="Unlink asset">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={availableAssets.length ? "Select unlinked asset…" : "No unlinked assets available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAssets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.assetTag} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!selectedAssetId || pending} onClick={() => linkAsset(selectedAssetId)}>
                  {pending ? "…" : "Link"}
                </Button>
              </div>
            </div>

            <div className="border-t" />

            {/* ── Licenses ── */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Licenses</p>
              {assignedLicenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No licenses assigned.</p>
              ) : (
                <div className="space-y-1">
                  {assignedLicenses.map((license) => (
                    <div key={license.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-medium">{license.licenseId}</span>
                        <span className="truncate text-muted-foreground">{license.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{license.vendor}</span>
                      </div>
                      <Button size="icon" variant="ghost" className="ml-2 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => unlinkLicense(license.id)} aria-label="Unlink license">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Select value={selectedLicenseId} onValueChange={setSelectedLicenseId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={availableLicenses.length ? "Select unlinked license…" : "No unlinked licenses available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLicenses.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.licenseId} — {l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!selectedLicenseId || pending} onClick={() => linkLicense(selectedLicenseId)}>
                  {pending ? "…" : "Link"}
                </Button>
              </div>
            </div>

            {message && <p className="text-sm text-destructive">{message}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Employee Dialog ──────────────────────────────────────────────────────

function EmployeeEditDialog({ employee, companies }: { employee: EmployeeRow; companies: CompanyOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(employee.status);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(employee.companies.map((company) => company.id));
  const [showVpnPassword, setShowVpnPassword] = useState(false);

  function toggleCompany(companyId: string, checked: boolean) {
    setSelectedCompanyIds((current) => checked ? Array.from(new Set([...current, companyId])) : current.filter((id) => id !== companyId));
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
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Pencil className="h-4 w-4" /> Edit</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
          <DialogDescription>Update employee details and company assignment.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <Field label="Employee ID" id="employeeId"><Input id="employeeId" name="employeeId" defaultValue={employee.employeeId} /></Field>
          <Field label="Name" id="name"><Input id="name" name="name" defaultValue={employee.name} /></Field>
          <Field label="Email" id="email"><Input id="email" name="email" type="email" defaultValue={employee.email ?? ""} /></Field>
          <Field label="Phone" id="phone"><Input id="phone" name="phone" defaultValue={employee.phone ?? ""} /></Field>
          <Field label="Department" id="department"><Input id="department" name="department" defaultValue={employee.department} /></Field>
          <Field label="Job Title" id="jobTitle"><Input id="jobTitle" name="jobTitle" defaultValue={employee.jobTitle} /></Field>
          <Field label="Location" id="location"><Input id="location" name="location" defaultValue={employee.location ?? ""} /></Field>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{formatEnum(item)}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <p className="text-sm font-semibold text-muted-foreground">Network / VPN Access</p>
          </div>
          <Field label="IP Address" id="ipAddress"><Input id="ipAddress" name="ipAddress" placeholder="192.168.1.x" defaultValue={employee.ipAddress ?? ""} /></Field>
          <Field label="VPN User ID" id="vpnUserId"><Input id="vpnUserId" name="vpnUserId" defaultValue={employee.vpnUserId ?? ""} /></Field>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="vpnPassword">VPN Password</Label>
            <div className="relative">
              <Input id="vpnPassword" name="vpnPassword" type={showVpnPassword ? "text" : "password"} placeholder={employee.vpnPassword ? "Leave blank to keep current" : "Set VPN password"} className="pr-10" />
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
                  <input className="h-4 w-4 shrink-0 rounded border-input" type="checkbox" checked={selectedCompanyIds.includes(company.id)} onChange={(event) => toggleCompany(company.id, event.target.checked)} />
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
