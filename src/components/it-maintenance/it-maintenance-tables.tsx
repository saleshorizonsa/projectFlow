import { differenceInCalendarDays, differenceInYears } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LicenseActions } from "@/components/it-maintenance/license-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEnum } from "@/lib/utils";

type Company = { id: string; code: string; name: string };
type User = { name: string };
type Employee = { employeeId: string; name: string };

export type AssetTableRow = {
  id: string;
  assetTag: string;
  name: string;
  type: string;
  vendor: string;
  model: string;
  location: string;
  purchaseDate: Date;
  warrantyExpiry?: Date | null;
  lifecycleYears: number;
  status: string;
  notes?: string | null;
  assignedToId?: string | null;
  employeeId?: string | null;
  assignedTo: User | null;
  employee: Employee | null;
  companies: { company: Company }[];
  maintenances?: { scheduledAt: Date; status: string }[];
};

export type MaintenanceTableRow = {
  id: string;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: string;
  responsible: User;
  asset: AssetTableRow;
};

export type LicenseTableRow = {
  id: string;
  licenseId: string;
  name: string;
  vendor: string;
  assetId?: string | null;
  seats: number;
  cost?: unknown;
  expiryDate: Date;
  owner?: string;
  asset: AssetTableRow | null;
  notes?: string | null;
  _count?: { assignments: number };
};

type AssetOption = { id: string; name: string; assetTag: string };

export function MaintenanceCalendarTable({ maintenances, compact = false }: { maintenances: MaintenanceTableRow[]; compact?: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle>Maintenance Calendar</CardTitle></CardHeader>
      <CardContent>
        <div className={compact ? "max-h-[420px] overflow-auto rounded-md border" : "overflow-auto rounded-md border"}>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Window</TableHead><TableHead>Asset</TableHead><TableHead>Owner</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {maintenances.map((maintenance) => (
                <TableRow key={maintenance.id}>
                  <TableCell>
                    <div className="font-medium">{maintenance.title}</div>
                    <div className="text-xs text-muted-foreground">{maintenance.scheduledAt.toLocaleString()} / {maintenance.durationMinutes} min</div>
                  </TableCell>
                  <TableCell>
                    <div>{maintenance.asset.assetTag} / {maintenance.asset.name}</div>
                    <div className="text-xs text-muted-foreground">Custodian: {maintenance.asset.assignedTo?.name ?? "Unassigned"}</div>
                    <div className="text-xs text-muted-foreground">Employee: {maintenance.asset.employee ? `${maintenance.asset.employee.employeeId} / ${maintenance.asset.employee.name}` : "Unassigned"}</div>
                    <CompanyBadges companies={maintenance.asset.companies.map((link) => link.company)} />
                  </TableCell>
                  <TableCell>{maintenance.responsible.name}</TableCell>
                  <TableCell><Badge variant={maintenance.status === "COMPLETED" ? "success" : "secondary"}>{formatEnum(maintenance.status)}</Badge></TableCell>
                </TableRow>
              ))}
              {maintenances.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No maintenance windows planned.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function LicenseExpiryTable({ licenses, compact = false, canManage = false, assets = [] }: { licenses: LicenseTableRow[]; compact?: boolean; canManage?: boolean; assets?: AssetOption[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>License Expiry Tracker</CardTitle></CardHeader>
      <CardContent>
        <div className={compact ? "max-h-[420px] overflow-auto rounded-md border" : "overflow-auto rounded-md border"}>
          <Table>
            <TableHeader>
              <TableRow><TableHead>License</TableHead><TableHead>Asset</TableHead><TableHead>Seats</TableHead><TableHead>Expiry</TableHead><TableHead>Risk</TableHead>{canManage && <TableHead className="text-right">Admin</TableHead>}</TableRow>
            </TableHeader>
            <TableBody>
              {licenses.map((license) => {
                const risk = licenseRisk(license.expiryDate);
                const used = license._count?.assignments ?? 0;
                return (
                  <TableRow key={license.id}>
                    <TableCell>
                      <div className="font-medium">{license.name}</div>
                      <div className="text-xs text-muted-foreground">{license.vendor}</div>
                    </TableCell>
                    <TableCell>
                      <div>{license.asset ? `${license.asset.assetTag} / ${license.asset.name}` : "Unlinked"}</div>
                      {license.asset && <div className="text-xs text-muted-foreground">Custodian: {license.asset.assignedTo?.name ?? "Unassigned"}</div>}
                      {license.asset && <CompanyBadges companies={license.asset.companies.map((link) => link.company)} />}
                    </TableCell>
                    <TableCell>
                      <span className={used >= license.seats ? "font-semibold text-destructive" : ""}>{used}/{license.seats}</span>
                    </TableCell>
                    <TableCell>{license.expiryDate.toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={risk.variant}>{risk.label}</Badge></TableCell>
                    {canManage && (
                      <TableCell>
                        <LicenseActions
                          license={{
                            id: license.id,
                            licenseId: license.licenseId,
                            name: license.name,
                            vendor: license.vendor,
                            assetId: license.assetId ?? null,
                            seats: license.seats,
                            cost: Number(license.cost ?? 0),
                            expiryDate: license.expiryDate.toISOString(),
                            owner: license.owner ?? "",
                            notes: license.notes ?? null,
                          }}
                          assets={assets}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {licenses.length === 0 && <TableRow><TableCell colSpan={canManage ? 6 : 5} className="text-center text-muted-foreground">No licenses tracked.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompanyBadges({ companies }: { companies: Company[] }) {
  if (companies.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {companies.map((company) => <Badge key={company.id} variant="outline">{company.code}</Badge>)}
    </div>
  );
}

export function licenseRisk(expiryDate: Date): { label: string; variant: "success" | "warning" | "destructive" } {
  const days = differenceInCalendarDays(expiryDate, new Date());
  if (days < 0) return { label: `${Math.abs(days)} day(s) expired`, variant: "destructive" };
  if (days <= 30) return { label: `${days} day(s) left`, variant: "destructive" };
  if (days <= 90) return { label: `${days} day(s) left`, variant: "warning" };
  return { label: "Healthy", variant: "success" };
}

export function hardwareRecommendation(purchaseDate: Date, lifecycleYears: number): { label: string; level: "green" | "yellow" | "red"; variant: "success" | "warning" | "destructive" } {
  const age = differenceInYears(new Date(), purchaseDate);
  if (age >= lifecycleYears) return { label: "Replace / upgrade now", level: "red", variant: "destructive" };
  if (age >= lifecycleYears - 1) return { label: "Plan upgrade budget", level: "yellow", variant: "warning" };
  return { label: "Within lifecycle", level: "green", variant: "success" };
}
