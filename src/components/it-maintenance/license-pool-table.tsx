"use client";

import { useState, useTransition } from "react";
import { differenceInCalendarDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, UserPlus, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { LicenseActions } from "@/components/it-maintenance/license-actions";

type EmployeeOption = { id: string; name: string; employeeId: string };
type AssetOption = { id: string; name: string; assetTag: string };

type Assignment = {
  id: string;
  employeeId: string;
  assignedAt: string;
  notes: string | null;
  employee: { id: string; employeeId: string; name: string; department: string | null };
};

export type LicensePool = {
  id: string;
  licenseId: string;
  name: string;
  vendor: string;
  seats: number;
  cost: number;
  expiryDate: string;
  owner: string;
  assetId: string | null;
  notes: string | null;
  assignments: Assignment[];
};

function licenseRisk(expiryDate: string) {
  const days = differenceInCalendarDays(new Date(expiryDate), new Date());
  if (days < 0) return { label: "Expired", variant: "destructive" as const };
  if (days <= 30) return { label: `${days}d left`, variant: "destructive" as const };
  if (days <= 90) return { label: `${days}d left`, variant: "warning" as const };
  return { label: "Active", variant: "success" as const };
}

// ─── Assign Seat Dialog ───────────────────────────────────────────────────────
function AssignSeatDialog({ license, employees, onAssigned }: {
  license: LicensePool;
  employees: EmployeeOption[];
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const available = license.seats - license.assignments.length;
  const assignedIds = new Set(license.assignments.map((a) => a.employeeId));
  const eligible = employees.filter((e) => !assignedIds.has(e.id));

  function assign() {
    if (!employeeId) { setError("Select an employee."); return; }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/it-licenses/${license.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, notes: notes.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Assignment failed.");
        return;
      }
      setOpen(false);
      setEmployeeId("");
      setNotes("");
      onAssigned();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        disabled={available <= 0}
        title={available <= 0 ? "No seats available" : `${available} seat(s) available`}
        onClick={() => setOpen(true)}
      >
        <UserPlus className="mr-1 h-3.5 w-3.5" />Assign Seat
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Seat — {license.name}</DialogTitle>
            <DialogDescription>
              {license.assignments.length} / {license.seats} seats used · {available} available
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Pick an employee…" /></SelectTrigger>
                <SelectContent>
                  {eligible.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.employeeId} / {e.name}</SelectItem>
                  ))}
                  {eligible.length === 0 && (
                    <SelectItem value="__none" disabled>All employees already assigned</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea
                placeholder="e.g. E3 plan, linked to onboarding…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={assign} disabled={pending || eligible.length === 0}>
              {pending ? "Assigning…" : "Assign Seat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── License Row ─────────────────────────────────────────────────────────────
function LicenseRow({ license, canManage, employees, assets, onRefresh }: {
  license: LicensePool;
  canManage: boolean;
  employees: EmployeeOption[];
  assets: AssetOption[];
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [revoking, startRevoke] = useTransition();

  const used = license.assignments.length;
  const pct = license.seats > 0 ? Math.round((used / license.seats) * 100) : 0;
  const risk = licenseRisk(license.expiryDate);

  function revoke(assignmentId: string) {
    if (!window.confirm("Revoke this seat assignment?")) return;
    startRevoke(async () => {
      await fetch(`/api/it-licenses/${license.id}/assignments/${assignmentId}`, { method: "DELETE" });
      onRefresh();
    });
  }

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40"
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell className="w-6 pr-0">
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </TableCell>
        <TableCell>
          <div className="font-medium">{license.name}</div>
          <div className="text-xs text-muted-foreground">{license.licenseId} · {license.vendor}</div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className={`font-semibold tabular-nums ${pct >= 100 ? "text-destructive" : pct >= 80 ? "text-amber-600" : "text-foreground"}`}>
              {used}/{license.seats}
            </span>
            <span className="text-xs text-muted-foreground">seats</span>
          </div>
          <Progress
            value={pct}
            className={`mt-1 h-1.5 w-24 ${pct >= 100 ? "[&>div]:bg-destructive" : pct >= 80 ? "[&>div]:bg-amber-500" : ""}`}
          />
        </TableCell>
        <TableCell className="tabular-nums text-sm">
          {license.cost > 0 ? `${Number(license.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
        </TableCell>
        <TableCell className="text-sm">{new Date(license.expiryDate).toLocaleDateString("en-GB")}</TableCell>
        <TableCell><Badge variant={risk.variant}>{risk.label}</Badge></TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <AssignSeatDialog license={license} employees={employees} onAssigned={() => { onRefresh(); setExpanded(true); }} />
            {canManage && (
              <LicenseActions
                license={{
                  id: license.id,
                  licenseId: license.licenseId,
                  name: license.name,
                  vendor: license.vendor,
                  assetId: license.assetId,
                  seats: license.seats,
                  cost: license.cost,
                  expiryDate: new Date(license.expiryDate).toISOString(),
                  owner: license.owner,
                  notes: license.notes,
                }}
                assets={assets}
              />
            )}
          </div>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell />
          <TableCell colSpan={6} className="bg-muted/20 pb-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Seat Assignments ({used}/{license.seats})
                </p>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>Owner: <span className="font-medium text-foreground">{license.owner}</span></span>
                  {license.notes && <span className="truncate max-w-48">{license.notes}</span>}
                </div>
              </div>
              {license.assignments.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">No seats assigned yet.</p>
              ) : (
                <div className="overflow-auto rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead>Note</TableHead>
                        {canManage && <TableHead className="text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {license.assignments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{a.employee.name}</div>
                            <div className="text-xs text-muted-foreground">{a.employee.employeeId}</div>
                          </TableCell>
                          <TableCell className="text-sm">{a.employee.department ?? "—"}</TableCell>
                          <TableCell className="text-sm">{new Date(a.assignedAt).toLocaleDateString("en-GB")}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{a.notes ?? "—"}</TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => revoke(a.id)}
                                disabled={revoking}
                              >
                                <UserMinus className="mr-1 h-3.5 w-3.5" />Revoke
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export function LicensePoolTable({ licenses, canManage = false, employees = [], assets = [] }: {
  licenses: LicensePool[];
  canManage?: boolean;
  employees?: EmployeeOption[];
  assets?: AssetOption[];
}) {
  const router = useRouter();

  const totalSeats = licenses.reduce((s, l) => s + l.seats, 0);
  const usedSeats = licenses.reduce((s, l) => s + l.assignments.length, 0);
  const expiring = licenses.filter((l) => {
    const d = differenceInCalendarDays(new Date(l.expiryDate), new Date());
    return d >= 0 && d <= 30;
  }).length;
  const expired = licenses.filter((l) => differenceInCalendarDays(new Date(l.expiryDate), new Date()) < 0).length;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total Licenses", value: licenses.length },
          { label: "Total Seats", value: totalSeats },
          { label: "Seats Used", value: usedSeats },
          { label: "Seats Available", value: Math.max(0, totalSeats - usedSeats) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {(expiring > 0 || expired > 0) && (
        <div className="flex gap-2">
          {expired > 0 && <Badge variant="destructive">{expired} expired</Badge>}
          {expiring > 0 && <Badge variant="warning">{expiring} expiring within 30 days</Badge>}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">License Register</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6" />
                  <TableHead>License</TableHead>
                  <TableHead>Seats Used</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licenses.map((license) => (
                  <LicenseRow
                    key={license.id}
                    license={license}
                    canManage={canManage}
                    employees={employees}
                    assets={assets}
                    onRefresh={router.refresh}
                  />
                ))}
                {licenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No licenses found. Add your first license to start tracking seats.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
