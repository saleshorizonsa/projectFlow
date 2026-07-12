import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { CalendarClock, HardDrive, KeyRound, LifeBuoy, ShieldCheck, TriangleAlert } from "lucide-react";
import { AssetRegisterTable } from "@/components/it-maintenance/asset-register-table";
import { hardwareRecommendation, LicenseExpiryTable, MaintenanceCalendarTable } from "@/components/it-maintenance/it-maintenance-tables";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assetCompanyWhere, relatedAssetCompanyWhere, selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function ITMaintenancePage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const prisma = getPrisma();
  const companyId = await selectedCompanyId(searchParams);
  const [assets, maintenances, licenses, supportTicketCount] = await Promise.all([
    prisma.iTAsset.findMany({ where: assetCompanyWhere(companyId), include: { assignedTo: true, employee: true, companies: { include: { company: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.iTMaintenance.findMany({ where: { ...relatedAssetCompanyWhere(companyId), status: { not: "COMPLETED" }, scheduledAt: { gte: new Date() } }, include: { asset: { include: { assignedTo: true, employee: true, companies: { include: { company: true } } } }, responsible: true }, orderBy: { scheduledAt: "asc" }, take: 8 }),
    prisma.iTLicense.findMany({ where: companyId ? { OR: [{ asset: assetCompanyWhere(companyId) }, { assetId: null }] } : {}, include: { _count: { select: { assignments: true } }, asset: { include: { assignedTo: true, employee: true, companies: { include: { company: true } } } } }, orderBy: { expiryDate: "asc" }, take: 50 }),
    prisma.supportTicket.count({ where: { ...(companyId ? { companyId } : {}), status: { notIn: ["RESOLVED", "CLOSED"] }, OR: [{ assetId: { not: null } }, { licenseId: { not: null } }] } }),
  ]);
  const now = new Date();
  const expiringLicenses = licenses.filter((license) => differenceInCalendarDays(license.expiryDate, now) <= 45);
  const upcomingMaintenance = maintenances; // already filtered to upcoming & incomplete at query level
  const upgradeAssets = assets.filter((asset) => hardwareRecommendation(asset.purchaseDate, asset.lifecycleYears).level !== "green");

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-background to-background">
          <CardTitle>IT Maintenance</CardTitle>
          <CardDescription>Overview for assets, maintenance windows, licenses, lifecycle risk, and support-ticket load.</CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Assets / Apps" value={assets.length} icon={HardDrive} variant="secondary" />
        <Metric title="Upcoming Maintenance" value={upcomingMaintenance.length} icon={CalendarClock} variant={upcomingMaintenance.length ? "warning" : "success"} />
        <Metric title="Licenses Expiring" value={expiringLicenses.length} icon={TriangleAlert} variant={expiringLicenses.length ? "destructive" : "success"} />
        <Metric title="Upgrade Review" value={upgradeAssets.length} icon={ShieldCheck} variant={upgradeAssets.length ? "warning" : "success"} />
        <Metric title="Asset Support Tickets" value={supportTicketCount} icon={LifeBuoy} variant={supportTicketCount ? "warning" : "success"} />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <ModuleCard href="/it-maintenance/assets" title="Assets & Applications" description="Add servers, routers, laptops, applications, cloud services, and lifecycle data." icon={HardDrive} />
        <ModuleCard href="/it-maintenance/maintenance" title="Maintenance Windows" description="Plan firmware upgrades, downtime windows, patching, and responsible owners." icon={CalendarClock} />
        <ModuleCard href="/it-maintenance/licenses" title="Licenses & Renewals" description="Track subscriptions, expiry dates, costs, and employee assignments." icon={KeyRound} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <MaintenanceCalendarTable maintenances={maintenances.slice(0, 8)} compact />
        <LicenseExpiryTable licenses={licenses.slice(0, 8)} compact />
      </section>
      <AssetRegisterTable assets={assets.slice(0, 8)} compact />
    </div>
  );
}

function ModuleCard({ href, title, description, icon: Icon }: { href: string; title: string; description: string; icon: typeof HardDrive }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Icon className="h-5 w-5 shrink-0 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full"><Link href={href}>Open page</Link></Button>
      </CardContent>
    </Card>
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
