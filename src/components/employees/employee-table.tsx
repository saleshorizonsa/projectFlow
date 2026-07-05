"use client";

import Link from "next/link";
import { CheckCircle2, ChevronDown, Eye, EyeOff, FileText, Filter, Link2, Palmtree, Pencil, RotateCcw, Search, Trash2, UserX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatEnum } from "@/lib/utils";
import { DiscardChangesDialog } from "@/components/ui/discard-changes-dialog";

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
  leaveStartDate: string | null;
  leaveReturnDate: string | null;
  leaveReason: string | null;
  exitDate: string | null;
  offboardingNotes: string | null;
  companies: CompanyOption[];
  assets: AssetItem[];
  licenses: LicenseItem[];
  openTickets: number;
};

const statuses = ["ACTIVE", "INACTIVE", "ON_LEAVE", "EXITED"];

export function EmployeeTable({
  employees,
  companies,
  canManage,
}: {
  employees: EmployeeRow[];
  companies: CompanyOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());
  const [activeDepts, setActiveDepts] = useState<Set<string>>(new Set());
  const [activeCompanies, setActiveCompanies] = useState<Set<string>>(new Set());
  const [activeLocations, setActiveLocations] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);

  const allDepts = useMemo(() =>
    [...new Set(employees.map(e => e.department))].sort(), [employees]);
  const allLocations = useMemo(() =>
    [...new Set(employees.map(e => e.location).filter(Boolean) as string[])].sort(), [employees]);
  const allCompanyCodes = useMemo(() =>
    [...new Set(employees.flatMap(e => e.companies.map(c => c.code)))].sort(), [employees]);

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, value: string) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setFn(next);
  }

  const drillCount = activeDepts.size + activeCompanies.size + activeLocations.size;

  const filtered = useMemo(() => employees.filter((e) => {
    if (activeStatuses.size > 0 && !activeStatuses.has(e.status)) return false;
    if (activeDepts.size > 0 && !activeDepts.has(e.department)) return false;
    if (activeLocations.size > 0 && !activeLocations.has(e.location ?? "")) return false;
    if (activeCompanies.size > 0 && !e.companies.some(c => activeCompanies.has(c.code))) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q) ||
      e.jobTitle.toLowerCase().includes(q) ||
      (e.email ?? "").toLowerCase().includes(q) ||
      e.companies.some(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    );
  }), [employees, search, activeStatuses, activeDepts, activeLocations, activeCompanies]);

  async function deleteEmployee(employee: EmployeeRow) {
    if (
      !window.confirm(
        `Delete employee "${employee.name}"? All linked assets and licenses will be unlinked automatically.`,
      )
    )
      return;
    const response = await fetch(`/api/employees/${employee.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null);
    if (!response.ok) window.alert(body?.error ?? "Employee delete failed.");
    router.refresh();
  }

  function statusVariant(s: string): "success" | "destructive" | "secondary" | "warning" {
    if (s === "ACTIVE") return "success";
    if (s === "EXITED") return "destructive";
    if (s === "ON_LEAVE") return "warning";
    return "secondary";
  }

  return (
    <Card>
      <CardContent className="pt-5">
        {/* Search + checkbox status filters */}
        <div className="mb-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, department, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Filter:</span>
            {[
              { value: "ACTIVE",   label: "Active",    variant: "success"     },
              { value: "ON_LEAVE", label: "On Leave",  variant: "warning"     },
              { value: "INACTIVE", label: "Inactive",  variant: "secondary"   },
              { value: "EXITED",   label: "Exited",    variant: "destructive" },
            ].map(({ value, label, variant }) => {
              const count = employees.filter(e => e.status === value).length;
              const checked = activeStatuses.has(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggle(activeStatuses, setActiveStatuses, value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    checked
                      ? variant === "success"     ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : variant === "warning"     ? "border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : variant === "destructive" ? "border-red-500 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                      :                            "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className={cn(
                    "h-3.5 w-3.5 rounded-sm border flex items-center justify-center shrink-0",
                    checked ? "border-current bg-current" : "border-current/40"
                  )}>
                    {checked && <X className="h-2.5 w-2.5 text-white dark:text-black" />}
                  </span>
                  {label}
                  <span className="ml-0.5 rounded-full bg-background/60 px-1 tabular-nums">{count}</span>
                </button>
              );
            })}
            {(search || activeStatuses.size > 0 || drillCount > 0) && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setSearch(""); setActiveStatuses(new Set()); setActiveDepts(new Set()); setActiveCompanies(new Set()); setActiveLocations(new Set()); }}>
                <X className="h-3 w-3" /> Clear all
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {employees.length} employees</span>
          </div>

          {/* Drill-down filter panel toggle */}
          <div>
            <button
              type="button"
              onClick={() => setPanelOpen(v => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                drillCount > 0
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Drill-down Filters
              {drillCount > 0 && (
                <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] leading-none">{drillCount}</span>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", panelOpen && "rotate-180")} />
            </button>

            {panelOpen && (
              <div className="mt-2 grid gap-4 rounded-md border bg-muted/20 p-3 sm:grid-cols-3">
                {/* Department */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Department</p>
                  <div className="flex flex-col gap-1">
                    {allDepts.map(dept => {
                      const checked = activeDepts.has(dept);
                      const count = employees.filter(e => e.department === dept).length;
                      return (
                        <label key={dept} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(activeDepts, setActiveDepts, dept)}
                            className="h-3.5 w-3.5 rounded accent-primary"
                          />
                          <span className="flex-1 truncate">{dept}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                        </label>
                      );
                    })}
                    {allDepts.length === 0 && <p className="text-xs text-muted-foreground">No departments</p>}
                  </div>
                </div>

                {/* Company */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</p>
                  <div className="flex flex-col gap-1">
                    {allCompanyCodes.map(code => {
                      const checked = activeCompanies.has(code);
                      const count = employees.filter(e => e.companies.some(c => c.code === code)).length;
                      return (
                        <label key={code} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(activeCompanies, setActiveCompanies, code)}
                            className="h-3.5 w-3.5 rounded accent-primary"
                          />
                          <span className="flex-1 truncate">{code}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                        </label>
                      );
                    })}
                    {allCompanyCodes.length === 0 && <p className="text-xs text-muted-foreground">No companies</p>}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</p>
                  <div className="flex flex-col gap-1">
                    {allLocations.map(loc => {
                      const checked = activeLocations.has(loc);
                      const count = employees.filter(e => e.location === loc).length;
                      return (
                        <label key={loc} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(activeLocations, setActiveLocations, loc)}
                            className="h-3.5 w-3.5 rounded accent-primary"
                          />
                          <span className="flex-1 truncate">{loc}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                        </label>
                      );
                    })}
                    {allLocations.length === 0 && <p className="text-xs text-muted-foreground">No locations on record</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

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
              {filtered.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <Link href={`/employees/${employee.id}`} className="font-medium hover:underline">
                      {employee.employeeId} / {employee.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {employee.email ?? "No email"} / {employee.phone ?? "No phone"}
                    </div>
                    {employee.status === "ON_LEAVE" && employee.leaveReturnDate && (
                      <div className="text-xs text-amber-600 dark:text-amber-400">Returns: {employee.leaveReturnDate}</div>
                    )}
                    {employee.exitDate && (
                      <div className="text-xs text-orange-600">Exited: {employee.exitDate}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <CompanyBadges companies={employee.companies} />
                  </TableCell>
                  <TableCell>
                    <div>{employee.jobTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      {employee.department} / {employee.location ?? "No location"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.assets.length ? "secondary" : "outline"}>
                      {employee.assets.length}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.licenses.length ? "secondary" : "outline"}>
                      {employee.licenses.length}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(employee.status)}>{formatEnum(employee.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/employees/${employee.id}/asset-report`}>
                          <FileText className="h-4 w-4" /> Report
                        </Link>
                      </Button>
                      {employee.status === "ON_LEAVE" && (
                        <Button asChild size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400">
                          <Link href={`/employees/${employee.id}/leave-form`}>
                            <Palmtree className="h-4 w-4" /> Leave Form
                          </Link>
                        </Button>
                      )}
                      {canManage && employee.status === "ACTIVE" && (
                        <EmployeeAssignDialog employee={employee} />
                      )}
                      {canManage && employee.status === "ACTIVE" && (
                        <EmployeeSetOnLeaveDialog employee={employee} />
                      )}
                      {canManage && employee.status === "ON_LEAVE" && (
                        <MarkReturnedButton employee={employee} />
                      )}
                      {canManage && employee.status === "ACTIVE" && (
                        <EmployeeOffboardDialog employee={employee} />
                      )}
                      {canManage && <EmployeeEditDialog employee={employee} companies={companies} />}
                      {canManage && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteEmployee(employee)}
                          aria-label="Delete employee"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="grid max-h-[620px] gap-3 overflow-auto pr-1 md:hidden">
          {filtered.map((employee) => (
            <div key={employee.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/employees/${employee.id}`} className="truncate font-medium hover:underline block">
                    {employee.employeeId} / {employee.name}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {employee.jobTitle} / {employee.department}
                  </div>
                  {employee.status === "ON_LEAVE" && employee.leaveReturnDate && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">Returns: {employee.leaveReturnDate}</div>
                  )}
                  {employee.exitDate && (
                    <div className="text-xs text-orange-600">Exited: {employee.exitDate}</div>
                  )}
                </div>
                <Badge className="shrink-0" variant={statusVariant(employee.status)}>
                  {formatEnum(employee.status)}
                </Badge>
              </div>
              <div className="mt-3">
                <CompanyBadges companies={employee.companies} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs text-muted-foreground">
                <div>
                  <div className="text-base font-semibold text-foreground">{employee.assets.length}</div>
                  Assets
                </div>
                <div>
                  <div className="text-base font-semibold text-foreground">{employee.licenses.length}</div>
                  Licenses
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/employees/${employee.id}/asset-report`}>
                    <FileText className="h-4 w-4" /> Report
                  </Link>
                </Button>
                {employee.status === "ON_LEAVE" && (
                  <Button asChild size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400">
                    <Link href={`/employees/${employee.id}/leave-form`}>
                      <Palmtree className="h-4 w-4" /> Leave Form
                    </Link>
                  </Button>
                )}
                {canManage && employee.status === "ACTIVE" && <EmployeeAssignDialog employee={employee} />}
                {canManage && employee.status === "ACTIVE" && <EmployeeSetOnLeaveDialog employee={employee} />}
                {canManage && employee.status === "ON_LEAVE" && <MarkReturnedButton employee={employee} />}
                {canManage && employee.status === "ACTIVE" && <EmployeeOffboardDialog employee={employee} />}
                {canManage && <EmployeeEditDialog employee={employee} companies={companies} />}
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => deleteEmployee(employee)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Mark Returned ─────────────────────────────────────────────────────────────

function MarkReturnedButton({ employee }: { employee: EmployeeRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function markReturned() {
    startTransition(async () => {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE", leaveStartDate: null, leaveReturnDate: null, leaveReason: null }),
      });
      if (res.ok) {
        toast.success(`${employee.name} is back — status set to Active`);
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Failed to update status.");
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={markReturned}
      className="border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400"
    >
      <RotateCcw className="h-4 w-4" /> Returned
    </Button>
  );
}

// ── Set on Leave Wizard ───────────────────────────────────────────────────────

const LEAVE_REASONS = ["Annual Leave", "Sick Leave", "Maternity / Paternity Leave", "Training", "Study Leave", "Other"];

function EmployeeSetOnLeaveDialog({ employee }: { employee: EmployeeRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [pendingAssets, setPendingAssets] = useState<AssetItem[]>([]);
  const [pendingLicenses, setPendingLicenses] = useState<LicenseItem[]>([]);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveReturn, setLeaveReturn] = useState("");
  const [leaveReason, setLeaveReason] = useState("Annual Leave");
  const [leaveNotes, setLeaveNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleOpen(v: boolean) {
    if (v) {
      setStep(0);
      setPendingAssets([...employee.assets]);
      setPendingLicenses([...employee.licenses]);
      setLeaveStart(new Date().toISOString().split("T")[0]);
      setLeaveReturn("");
      setLeaveReason("Annual Leave");
      setLeaveNotes("");
      setMessage(null);
    }
    setOpen(v);
  }

  function returnAsset(assetId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/it-assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: "" }),
      });
      if (res.ok) { setPendingAssets(prev => prev.filter(a => a.id !== assetId)); router.refresh(); }
      else setMessage("Failed to unlink asset.");
    });
  }

  function returnAllAssets() {
    startTransition(async () => {
      await Promise.all(pendingAssets.map(a =>
        fetch(`/api/it-assets/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: "" }) })
      ));
      setPendingAssets([]);
      router.refresh();
    });
  }

  function revokeLicense(licenseId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/it-licenses/${licenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: "" }),
      });
      if (res.ok) { setPendingLicenses(prev => prev.filter(l => l.id !== licenseId)); router.refresh(); }
      else setMessage("Failed to revoke license.");
    });
  }

  function revokeAllLicenses() {
    startTransition(async () => {
      await Promise.all(pendingLicenses.map(l =>
        fetch(`/api/it-licenses/${l.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: "" }) })
      ));
      setPendingLicenses([]);
      router.refresh();
    });
  }

  function complete() {
    if (!leaveReturn) { setMessage("Please set an expected return date."); return; }
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ON_LEAVE",
          leaveStartDate: leaveStart || null,
          leaveReturnDate: leaveReturn || null,
          leaveReason: leaveNotes ? `${leaveReason} — ${leaveNotes}` : leaveReason,
        }),
      });
      if (!res.ok) { setMessage("Failed to set leave status."); return; }
      toast.success(`${employee.name} is on leave until ${leaveReturn}`);
      setOpen(false);
      router.refresh();
    });
  }

  const STEPS = ["Clearance", "Set Dates", "Confirm"];

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-700 dark:text-amber-400"
        >
          <Palmtree className="h-4 w-4" /> On Leave
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Employee on Leave</DialogTitle>
          <DialogDescription>{employee.employeeId} / {employee.name}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5">
          {STEPS.map((label, i) => (
            <div key={i} className={cn(
              "flex-1 rounded-full py-1.5 text-center text-xs font-medium",
              i === step ? "bg-amber-500 text-white" : i < step ? "bg-muted text-muted-foreground" : "bg-muted/40 text-muted-foreground/60",
            )}>
              {i < step ? "✓ " : ""}{label}
            </div>
          ))}
        </div>

        {/* Step 0 — Clearance */}
        {step === 0 && (
          <div className="space-y-4">
            {employee.openTickets > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/20">
                <span className="mt-0.5 text-amber-600">⚠</span>
                <span className="text-amber-800 dark:text-amber-300">
                  <strong>{employee.openTickets}</strong> open support ticket{employee.openTickets !== 1 ? "s" : ""} assigned — reassign via IT Support before leave starts.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Assets to return? <span className="font-normal text-muted-foreground">({pendingAssets.length} held)</span></p>
              {pendingAssets.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> No assets to return.
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {pendingAssets.map(asset => (
                      <div key={asset.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium">{asset.assetTag}</span>
                          <span className="ml-2 truncate text-muted-foreground">{asset.name}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">{formatEnum(asset.type)}</Badge>
                        </div>
                        <Button size="sm" variant="outline" className="ml-2 shrink-0" disabled={pending} onClick={() => returnAsset(asset.id)}>Return</Button>
                      </div>
                    ))}
                  </div>
                  {pendingAssets.length > 1 && (
                    <Button size="sm" variant="outline" className="w-full" disabled={pending} onClick={returnAllAssets}>Return All ({pendingAssets.length})</Button>
                  )}
                  <p className="text-xs text-muted-foreground">You can leave assets assigned — they stay with the employee during leave.</p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Licenses to free up? <span className="font-normal text-muted-foreground">({pendingLicenses.length} held)</span></p>
              {pendingLicenses.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> No licenses to free.
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {pendingLicenses.map(license => (
                      <div key={license.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium">{license.licenseId}</span>
                          <span className="ml-2 truncate text-muted-foreground">{license.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{license.vendor}</span>
                        </div>
                        <Button size="sm" variant="outline" className="ml-2 shrink-0" disabled={pending} onClick={() => revokeLicense(license.id)}>Free</Button>
                      </div>
                    ))}
                  </div>
                  {pendingLicenses.length > 1 && (
                    <Button size="sm" variant="outline" className="w-full" disabled={pending} onClick={revokeAllLicenses}>Free All ({pendingLicenses.length})</Button>
                  )}
                  <p className="text-xs text-muted-foreground">Freeing a license allows it to be reassigned while the employee is away.</p>
                </>
              )}
            </div>

            {message && <p className="text-sm text-destructive">{message}</p>}
            <div className="flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => { setMessage(null); setStep(1); }}>Next →</Button>
            </div>
          </div>
        )}

        {/* Step 1 — Set Dates */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leave-reason">Leave Type *</Label>
              <Select value={leaveReason} onValueChange={setLeaveReason}>
                <SelectTrigger id="leave-reason"><SelectValue /></SelectTrigger>
                <SelectContent>{LEAVE_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="leave-start">Start Date *</Label>
                <Input id="leave-start" type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leave-return">Expected Return *</Label>
                <Input id="leave-return" type="date" value={leaveReturn} onChange={e => setLeaveReturn(e.target.value)} min={leaveStart} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-notes">Notes (optional)</Label>
              <textarea
                id="leave-notes"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                rows={2}
                placeholder="e.g. Pre-approved by HR on 01/07/2026"
                value={leaveNotes}
                onChange={e => setLeaveNotes(e.target.value)}
              />
            </div>
            {message && <p className="text-sm text-destructive">{message}</p>}
            <div className="flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setMessage(null); setStep(0); }}>← Back</Button>
              <Button size="sm" onClick={() => { if (!leaveReturn) { setMessage("Set an expected return date."); return; } setMessage(null); setStep(2); }}>Next →</Button>
            </div>
          </div>
        )}

        {/* Step 2 — Confirm */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-md border bg-amber-50 p-4 text-sm dark:bg-amber-950/20">
              <p className="font-semibold text-amber-800 dark:text-amber-400">Leave summary</p>
              <ul className="mt-2 space-y-1.5 text-muted-foreground">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />Status → <strong>On Leave</strong></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />Reason: <strong>{leaveReason}</strong></li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />Dates: <strong>{leaveStart}</strong> → <strong>{leaveReturn}</strong></li>
                {pendingAssets.length > 0 && (
                  <li className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <X className="h-3.5 w-3.5 shrink-0" />{pendingAssets.length} asset(s) remain assigned during leave
                  </li>
                )}
                {pendingLicenses.length > 0 && (
                  <li className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <X className="h-3.5 w-3.5 shrink-0" />{pendingLicenses.length} license(s) remain assigned during leave
                  </li>
                )}
              </ul>
              {leaveNotes && <p className="mt-2 text-xs text-muted-foreground">Notes: {leaveNotes}</p>}
            </div>
            {message && <p className="text-sm text-destructive">{message}</p>}
            <div className="flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setMessage(null); setStep(1); }}>← Back</Button>
              <Button
                size="sm"
                disabled={pending}
                className="bg-amber-500 text-white hover:bg-amber-600"
                onClick={complete}
              >
                {pending ? "Setting leave…" : "Confirm Leave"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Offboarding Wizard ────────────────────────────────────────────────────────

function EmployeeOffboardDialog({ employee }: { employee: EmployeeRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [pendingAssets, setPendingAssets] = useState<AssetItem[]>([]);
  const [pendingLicenses, setPendingLicenses] = useState<LicenseItem[]>([]);
  const [exitDate, setExitDate] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleOpen(v: boolean) {
    if (v) {
      setStep(0);
      setPendingAssets([...employee.assets]);
      setPendingLicenses([...employee.licenses]);
      setExitDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setMessage(null);
    }
    setOpen(v);
  }

  function returnAsset(assetId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/it-assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: "" }),
      });
      if (res.ok) {
        setPendingAssets((prev) => prev.filter((a) => a.id !== assetId));
        router.refresh();
      } else {
        setMessage("Failed to unlink asset.");
      }
    });
  }

  function returnAllAssets() {
    startTransition(async () => {
      await Promise.all(
        pendingAssets.map((a) =>
          fetch(`/api/it-assets/${a.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeId: "" }),
          }),
        ),
      );
      setPendingAssets([]);
      router.refresh();
    });
  }

  function revokeLicense(licenseId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/it-licenses/${licenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: "" }),
      });
      if (res.ok) {
        setPendingLicenses((prev) => prev.filter((l) => l.id !== licenseId));
        router.refresh();
      } else {
        setMessage("Failed to revoke license.");
      }
    });
  }

  function revokeAllLicenses() {
    startTransition(async () => {
      await Promise.all(
        pendingLicenses.map((l) =>
          fetch(`/api/it-licenses/${l.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeId: "" }),
          }),
        ),
      );
      setPendingLicenses([]);
      router.refresh();
    });
  }

  function complete() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "EXITED",
          ipAddress: "",
          vpnUserId: "",
          vpnPassword: "",
          exitDate: exitDate || null,
          offboardingNotes: notes || null,
        }),
      });
      if (!res.ok) {
        setMessage("Failed to complete offboarding.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const STEPS = ["Return Assets", "Revoke Licenses", "Complete"];

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-800 dark:text-orange-400"
        >
          <UserX className="h-4 w-4" /> Offboard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Employee Offboarding</DialogTitle>
          <DialogDescription>
            {employee.employeeId} / {employee.name}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-1.5">
          {STEPS.map((label, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-full py-1.5 text-center text-xs font-medium",
                i === step
                  ? "bg-orange-600 text-white"
                  : i < step
                    ? "bg-muted text-muted-foreground"
                    : "bg-muted/40 text-muted-foreground/60",
              )}
            >
              {i < step ? "✓ " : ""}
              {label}
            </div>
          ))}
        </div>

        {/* Step 0 — Return Assets */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Mark each asset as returned to unlink it. You can proceed without returning all items.
            </p>
            {pendingAssets.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> All assets returned.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {pendingAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-medium">{asset.assetTag}</span>
                        <span className="ml-2 truncate text-muted-foreground">{asset.name}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {formatEnum(asset.type)}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 shrink-0"
                        disabled={pending}
                        onClick={() => returnAsset(asset.id)}
                      >
                        Return
                      </Button>
                    </div>
                  ))}
                </div>
                {pendingAssets.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={pending}
                    onClick={returnAllAssets}
                  >
                    Return All ({pendingAssets.length})
                  </Button>
                )}
              </>
            )}
            {message && <p className="text-sm text-destructive">{message}</p>}
            <div className="flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setMessage(null);
                  setStep(1);
                }}
              >
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* Step 1 — Revoke Licenses */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Revoke software licenses assigned to this employee.
            </p>
            {pendingLicenses.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> All licenses revoked.
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {pendingLicenses.map((license) => (
                    <div
                      key={license.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-medium">{license.licenseId}</span>
                        <span className="ml-2 truncate text-muted-foreground">{license.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{license.vendor}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2 shrink-0"
                        disabled={pending}
                        onClick={() => revokeLicense(license.id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
                {pendingLicenses.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={pending}
                    onClick={revokeAllLicenses}
                  >
                    Revoke All ({pendingLicenses.length})
                  </Button>
                )}
              </>
            )}
            {message && <p className="text-sm text-destructive">{message}</p>}
            <div className="flex justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMessage(null);
                  setStep(0);
                }}
              >
                ← Back
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setMessage(null);
                  setStep(2);
                }}
              >
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Complete */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-md border bg-orange-50 p-3 text-sm dark:bg-orange-950/20">
              <p className="font-semibold text-orange-800 dark:text-orange-400">Actions on completion</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                  Status → <strong>EXITED</strong>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                  IP address, VPN User ID &amp; Password cleared
                </li>
                {pendingAssets.length > 0 && (
                  <li className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <X className="h-3.5 w-3.5 shrink-0" />
                    {pendingAssets.length} asset(s) not yet returned — will remain linked
                  </li>
                )}
                {pendingLicenses.length > 0 && (
                  <li className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <X className="h-3.5 w-3.5 shrink-0" />
                    {pendingLicenses.length} license(s) not yet revoked — will remain linked
                  </li>
                )}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ob-exit-date">Exit Date</Label>
              <Input
                id="ob-exit-date"
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-notes">Offboarding Notes</Label>
              <textarea
                id="ob-notes"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                rows={3}
                placeholder="Reason for leaving, equipment condition, handover details…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {message && <p className="text-sm text-destructive">{message}</p>}
            <div className="flex justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMessage(null);
                  setStep(1);
                }}
              >
                ← Back
              </Button>
              <Button
                size="sm"
                disabled={pending}
                className="bg-orange-600 text-white hover:bg-orange-700"
                onClick={complete}
              >
                {pending ? "Processing…" : "Complete Offboarding"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Assign Assets & Licenses ──────────────────────────────────────────────────

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
      fetch("/api/it-assets").then(async (r) => {
        if (!r.ok) throw new Error(`assets ${r.status}`);
        return r.json();
      }),
      fetch("/api/it-licenses").then(async (r) => {
        if (!r.ok) throw new Error(`licenses ${r.status}`);
        return r.json();
      }),
    ])
      .then(([assets, licenses]: [ApiAsset[], ApiLicense[]]) => {
        setAvailableAssets(Array.isArray(assets) ? assets.filter((a) => !a.employeeId) : []);
        setAvailableLicenses(Array.isArray(licenses) ? licenses.filter((l) => !l.employeeId) : []);
      })
      .catch((err: Error) => setMessage(`Failed to load available items: ${err.message}`))
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
      if (!res.ok) {
        setMessage((await res.json().catch(() => null))?.error ?? "Failed to link asset.");
        return;
      }
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
      if (!res.ok) {
        setMessage("Failed to unlink asset.");
        return;
      }
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
      if (!res.ok) {
        setMessage((await res.json().catch(() => null))?.error ?? "Failed to link license.");
        return;
      }
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
      if (!res.ok) {
        setMessage("Failed to unlink license.");
        return;
      }
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
          <DialogDescription>
            {employee.employeeId} / {employee.name}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading available items…</p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold">Assets</p>
              {assignedAssets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assets assigned.</p>
              ) : (
                <div className="space-y-1">
                  {assignedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-medium">{asset.assetTag}</span>
                        <span className="truncate text-muted-foreground">{asset.name}</span>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {formatEnum(asset.type)}
                        </Badge>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-2 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => unlinkAsset(asset.id)}
                        aria-label="Unlink asset"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue
                      placeholder={
                        availableAssets.length ? "Select unlinked asset…" : "No unlinked assets available"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAssets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.assetTag} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!selectedAssetId || pending} onClick={() => linkAsset(selectedAssetId)}>
                  {pending ? "…" : "Link"}
                </Button>
              </div>
            </div>

            <div className="border-t" />

            <div className="space-y-3">
              <p className="text-sm font-semibold">Licenses</p>
              {assignedLicenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No licenses assigned.</p>
              ) : (
                <div className="space-y-1">
                  {assignedLicenses.map((license) => (
                    <div
                      key={license.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-medium">{license.licenseId}</span>
                        <span className="truncate text-muted-foreground">{license.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{license.vendor}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-2 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => unlinkLicense(license.id)}
                        aria-label="Unlink license"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Select value={selectedLicenseId} onValueChange={setSelectedLicenseId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue
                      placeholder={
                        availableLicenses.length
                          ? "Select unlinked license…"
                          : "No unlinked licenses available"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLicenses.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.licenseId} — {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!selectedLicenseId || pending}
                  onClick={() => linkLicense(selectedLicenseId)}
                >
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

// ── Edit Employee ─────────────────────────────────────────────────────────────

function EmployeeEditDialog({
  employee,
  companies,
}: {
  employee: EmployeeRow;
  companies: CompanyOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(employee.status);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(
    employee.companies.map((company) => company.id),
  );
  const [showVpnPassword, setShowVpnPassword] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const vpnPasswordRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    if (!next && isDirty) {
      setDiscardOpen(true);
    } else {
      if (!next) setIsDirty(false);
      setOpen(next);
    }
  }

  useEffect(() => {
    if (open && vpnPasswordRef.current) {
      vpnPasswordRef.current.value = "";
    }
  }, [open]);

  function toggleCompany(companyId: string, checked: boolean) {
    setIsDirty(true);
    setSelectedCompanyIds((current) =>
      checked
        ? Array.from(new Set([...current, companyId]))
        : current.filter((id) => id !== companyId),
    );
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
        const details = body?.details ? Object.entries(body.details as Record<string, string[]>).map(([f, msgs]) => `${f}: ${(msgs as string[]).join(", ")}`).join(" · ") : null;
        setMessage(details ? `${body?.error ?? "Update failed"} — ${details}` : (body?.error ?? "Employee update failed. Please try again."));
        return;
      }
      setOpen(false);
      setIsDirty(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
          <DialogDescription>Update employee details and company assignment.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit} onChange={() => setIsDirty(true)}>
          <Field label="Employee ID" id="employeeId">
            <Input id="employeeId" name="employeeId" defaultValue={employee.employeeId} />
          </Field>
          <Field label="Name" id="name">
            <Input id="name" name="name" defaultValue={employee.name} />
          </Field>
          <Field label="Email" id="email">
            <Input id="email" name="email" type="email" defaultValue={employee.email ?? ""} />
          </Field>
          <Field label="Phone" id="phone">
            <Input id="phone" name="phone" defaultValue={employee.phone ?? ""} />
          </Field>
          <Field label="Department" id="department">
            <Input id="department" name="department" defaultValue={employee.department} />
          </Field>
          <Field label="Job Title" id="jobTitle">
            <Input id="jobTitle" name="jobTitle" defaultValue={employee.jobTitle} />
          </Field>
          <Field label="Location" id="location">
            <Input id="location" name="location" defaultValue={employee.location ?? ""} />
          </Field>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setIsDirty(true); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {formatEnum(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <p className="text-sm font-semibold text-muted-foreground">Network / VPN Access</p>
          </div>
          <Field label="IP Address" id="ipAddress">
            <Input
              id="ipAddress"
              name="ipAddress"
              placeholder="192.168.1.x"
              defaultValue={employee.ipAddress ?? ""}
            />
          </Field>
          <Field label="VPN User ID" id="vpnUserId">
            <Input id="vpnUserId" name="vpnUserId" defaultValue={employee.vpnUserId ?? ""} />
          </Field>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="vpnPassword">VPN Password</Label>
            <div className="relative">
              <Input
                id="vpnPassword"
                name="vpnPassword"
                ref={vpnPasswordRef}
                type={showVpnPassword ? "text" : "password"}
                placeholder={employee.vpnPassword ? "Leave blank to keep current" : "Set VPN password"}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowVpnPassword((v) => !v)}
                aria-label={showVpnPassword ? "Hide password" : "Show password"}
              >
                {showVpnPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-3 md:col-span-2">
            <Label>Companies</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {companies.map((company) => (
                <label
                  key={company.id}
                  className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium"
                >
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
          </div>
          {message && <p className="text-sm text-destructive md:col-span-2">{message}</p>}
          <Button className="md:col-span-2" disabled={pending}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </DialogContent>
      <DiscardChangesDialog
        open={discardOpen}
        onKeep={() => setDiscardOpen(false)}
        onDiscard={() => { setDiscardOpen(false); setIsDirty(false); setOpen(false); }}
      />
    </Dialog>
  );
}

function CompanyBadges({ companies }: { companies: CompanyOption[] }) {
  return (
    <div className="flex max-w-72 flex-wrap gap-1">
      {companies.map((company) => (
        <Badge key={company.id} variant="outline">
          {company.code}
        </Badge>
      ))}
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
