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
  lifecycleYears: number;
  status: string;
  assignedTo: User | null;
  employee: Employee | null;
  companies: { company: Company }[];
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
  employeeId?: string | null;
  asset: AssetTableRow | null;
  employee: Employee | null;
  notes?: string | null;
};

type AssetOption = { id: string; name: string; assetTag: string };
type EmployeeOption = { id: string; name: string; employeeId: string };

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

export function LicenseExpiryTable({ licenses, compact = false, canManage = false, assets = [], employees = [] }: { licenses: LicenseTableRow[]; compact?: boolean; canManage?: boolean; assets?: AssetOption[]; employees?: EmployeeOption[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>License Expiry Tracker</CardTitle></CardHeader>
      <CardContent>
        <div className={compact ? "max-h-[420px] overflow-auto rounded-md border" : "overflow-auto rounded-md border"}>
          <Table>
            <TableHeader>
              <TableRow><TableHead>License</TableHead><TableHead>Asset</TableHead><TableHead>Expiry</TableHead><TableHead>Risk</TableHead>{canManage && <TableHead className="text-right">Admin</TableHead>}</TableRow>
            </TableHeader>
            <TableBody>
              {licenses.map((license) => {
                const risk = licenseRisk(license.expiryDate);
                return (
                  <TableRow key={license.id}>
                    <TableCell>
                      <div className="font-medium">{license.name}</div>
                      <div className="text-xs text-muted-foreground">{license.vendor} / {license.seats} seat(s)</div>
                      <div className="text-xs text-muted-foreground">Employee: {license.employee ? `${license.employee.employeeId} / ${license.employee.name}` : "Unassigned"}</div>
                    </TableCell>
                    <TableCell>
                      <div>{license.asset ? `${license.asset.assetTag} / ${license.asset.name}` : "Unlinked"}</div>
                      {license.asset && <div className="text-xs text-muted-foreground">Custodian: {license.asset.assignedTo?.name ?? "Unassigned"}</div>}
                      {license.asset && <CompanyBadges companies={license.asset.companies.map((link) => link.company)} />}
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
                            employeeId: license.employeeId ?? null,
                            notes: license.notes ?? null,
                          }}
                          assets={assets}
                          employees={employees}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {licenses.length === 0 && <TableRow><TableCell colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground">No licenses tracked.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function AssetRegisterTable({ assets, compact = false }: { assets: AssetTableRow[]; compact?: boolean }) {
  const now = new Date();
  return (
    <Card>
      <CardHeader><CardTitle>Asset Register & Upgrade Recommendations</CardTitle></CardHeader>
      <CardContent>
        <div className={compact ? "max-h-[520px] overflow-auto rounded-md border" : "overflow-auto rounded-md border"}>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Asset</TableHead><TableHead>Type</TableHead><TableHead>Location</TableHead><TableHead>Age</TableHead><TableHead>Recommendation</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => {
                const recommendation = hardwareRecommendation(asset.purchaseDate, asset.lifecycleYears);
                return (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div className="font-medium">{asset.assetTag} / {asset.name}</div>
                      <div className="text-xs text-muted-foreground">{asset.vendor} / {asset.model}</div>
                      <div className="text-xs text-muted-foreground">Custodian: {asset.assignedTo?.name ?? "Unassigned"}</div>
                      <div className="text-xs text-muted-foreground">Employee: {asset.employee ? `${asset.employee.employeeId} / ${asset.employee.name}` : "Unassigned"}</div>
                      <CompanyBadges companies={asset.companies.map((link) => link.company)} />
                    </TableCell>
                    <TableCell>{formatEnum(asset.type)}</TableCell>
                    <TableCell>{asset.location}</TableCell>
                    <TableCell>{differenceInYears(now, asset.purchaseDate)} year(s)</TableCell>
                    <TableCell><Badge variant={recommendation.variant}>{recommendation.label}</Badge></TableCell>
                    <TableCell><Badge variant={asset.status === "ACTIVE" ? "success" : "secondary"}>{formatEnum(asset.status)}</Badge></TableCell>
                  </TableRow>
                );
              })}
              {assets.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Add servers, routers, applications, databases, or cloud services to begin maintenance planning.</TableCell></TableRow>}
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
