import { differenceInCalendarDays, differenceInYears } from "date-fns";
import { CalendarClock, HardDrive, ShieldCheck, TriangleAlert } from "lucide-react";
import { ITAssetForm, ITLicenseForm, ITMaintenanceForm } from "@/components/it-maintenance/it-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/lib/auth";
import { assetCompanyWhere, relatedAssetCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/utils";

export default async function ITMaintenancePage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const prisma = getPrisma();
  const companyId = await selectedCompanyId(searchParams);
  const [assets, maintenances, licenses, users, companies, employees] = await Promise.all([
    prisma.iTAsset.findMany({ where: assetCompanyWhere(companyId), include: { assignedTo: true, employee: true, companies: { include: { company: true } }, licenses: true, maintenances: true }, orderBy: { updatedAt: "desc" } }),
    prisma.iTMaintenance.findMany({ where: relatedAssetCompanyWhere(companyId), include: { asset: { include: { assignedTo: true, employee: true, companies: { include: { company: true } } } }, responsible: true }, orderBy: { scheduledAt: "asc" } }),
    prisma.iTLicense.findMany({ where: companyId ? { OR: [{ asset: assetCompanyWhere(companyId) }, { assetId: null }, { employee: { companies: { some: { companyId } } } }] } : {}, include: { employee: true, asset: { include: { assignedTo: true, employee: true, companies: { include: { company: true } } } } }, orderBy: { expiryDate: "asc" } }),
    prisma.user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: companyId ? { companies: { some: { companyId } } } : {}, orderBy: { name: "asc" } }),
  ]);
  const now = new Date();
  const expiringLicenses = licenses.filter((license) => differenceInCalendarDays(license.expiryDate, now) <= 45);
  const upcomingMaintenance = maintenances.filter((maintenance) => maintenance.status !== "COMPLETED" && differenceInCalendarDays(maintenance.scheduledAt, now) <= 30);
  const upgradeAssets = assets.filter((asset) => hardwareRecommendation(asset.purchaseDate, asset.lifecycleYears).level !== "green");
  const assetOptions = assets.map((asset) => ({ id: asset.id, name: asset.name, assetTag: asset.assetTag }));
  const userOptions = users.map((user) => ({ id: user.id, name: user.name }));
  const employeeOptions = employees.map((employee) => ({ id: employee.id, name: employee.name, employeeId: employee.employeeId }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>IT Maintenance</CardTitle>
          <CardDescription>Plan server, router, application, license, subscription, upgrade, and renewal maintenance windows.</CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Assets / Apps" value={assets.length} icon={HardDrive} variant="secondary" />
        <Metric title="Upcoming Maintenance" value={upcomingMaintenance.length} icon={CalendarClock} variant={upcomingMaintenance.length ? "warning" : "success"} />
        <Metric title="Licenses Expiring" value={expiringLicenses.length} icon={TriangleAlert} variant={expiringLicenses.length ? "destructive" : "success"} />
        <Metric title="Upgrade Review" value={upgradeAssets.length} icon={ShieldCheck} variant={upgradeAssets.length ? "warning" : "success"} />
      </section>

      {session?.user.role !== "VIEWER" && (
        <Tabs defaultValue="asset" className="space-y-4">
          <TabsList>
            <TabsTrigger value="asset">Add Asset</TabsTrigger>
            <TabsTrigger value="maintenance">Plan Maintenance</TabsTrigger>
            <TabsTrigger value="license">Add License</TabsTrigger>
          </TabsList>
          <TabsContent value="asset"><ITAssetForm companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))} users={userOptions} employees={employeeOptions} /></TabsContent>
          <TabsContent value="maintenance"><ITMaintenanceForm assets={assetOptions} users={userOptions} /></TabsContent>
          <TabsContent value="license"><ITLicenseForm assets={assetOptions} employees={employeeOptions} /></TabsContent>
        </Tabs>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Maintenance Calendar</CardTitle></CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>License Expiry Tracker</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>License</TableHead><TableHead>Asset</TableHead><TableHead>Expiry</TableHead><TableHead>Risk</TableHead></TableRow>
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
                    </TableRow>
                  );
                })}
                {licenses.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No licenses tracked.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Asset Register & Upgrade Recommendations</CardTitle></CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyBadges({ companies }: { companies: { id: string; code: string; name: string }[] }) {
  if (companies.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {companies.map((company) => <Badge key={company.id} variant="outline">{company.code}</Badge>)}
    </div>
  );
}

function Metric({ title, value, icon: Icon, variant }: { title: string; value: number; icon: typeof HardDrive; variant: "success" | "warning" | "destructive" | "secondary" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="truncate text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold leading-none">{value}</div>
        <Badge variant={variant}>{variant === "destructive" ? "Risk" : variant === "warning" ? "Review" : variant === "success" ? "OK" : "Track"}</Badge>
      </CardContent>
    </Card>
  );
}

function licenseRisk(expiryDate: Date): { label: string; variant: "success" | "warning" | "destructive" } {
  const days = differenceInCalendarDays(expiryDate, new Date());
  if (days < 0) return { label: `${Math.abs(days)} day(s) expired`, variant: "destructive" };
  if (days <= 30) return { label: `${days} day(s) left`, variant: "destructive" };
  if (days <= 90) return { label: `${days} day(s) left`, variant: "warning" };
  return { label: "Healthy", variant: "success" };
}

function hardwareRecommendation(purchaseDate: Date, lifecycleYears: number): { label: string; level: "green" | "yellow" | "red"; variant: "success" | "warning" | "destructive" } {
  const age = differenceInYears(new Date(), purchaseDate);
  if (age >= lifecycleYears) return { label: "Replace / upgrade now", level: "red", variant: "destructive" };
  if (age >= lifecycleYears - 1) return { label: "Plan upgrade budget", level: "yellow", variant: "warning" };
  return { label: "Within lifecycle", level: "green", variant: "success" };
}
