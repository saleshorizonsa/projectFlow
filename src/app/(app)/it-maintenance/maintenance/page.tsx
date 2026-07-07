import { CalendarCheck, CalendarX, Info } from "lucide-react";
import { ITMaintenanceForm } from "@/components/it-maintenance/it-forms";
import { MaintenanceCalendarTable } from "@/components/it-maintenance/it-maintenance-tables";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { assetCompanyWhere, relatedAssetCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function ITMaintenanceWindowsPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const prisma = getPrisma();
  const companyId = await selectedCompanyId(searchParams);
  const now = new Date();
  const [assets, maintenances, users] = await Promise.all([
    prisma.iTAsset.findMany({ where: assetCompanyWhere(companyId), orderBy: { assetTag: "asc" } }),
    prisma.iTMaintenance.findMany({ where: relatedAssetCompanyWhere(companyId), include: { asset: { include: { assignedTo: true, employee: true, companies: { include: { company: true } } } }, responsible: true }, orderBy: { scheduledAt: "asc" } }),
    prisma.user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
  ]);

  const upcoming = maintenances.filter((m) => m.scheduledAt >= now && m.status !== "COMPLETED").length;
  const overdue = maintenances.filter((m) => m.scheduledAt < now && m.status !== "COMPLETED").length;

  return (
    <div className="space-y-5">
      <Card><CardHeader><CardTitle>Maintenance Windows</CardTitle><CardDescription>Plan upgrades, patch windows, downtime, and owner accountability.</CardDescription></CardHeader></Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming</CardTitle>
            <CalendarCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <div className="text-3xl font-semibold leading-none">{upcoming}</div>
            <Badge variant="secondary">Scheduled</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            <CalendarX className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <div className="text-3xl font-semibold leading-none">{overdue}</div>
            <Badge variant={overdue ? "destructive" : "success"}>{overdue ? "Action needed" : "All clear"}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
            <CalendarCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-3">
            <div className="text-3xl font-semibold leading-none">{maintenances.length}</div>
            <Badge variant="outline">All time</Badge>
          </CardContent>
        </Card>
      </section>

      {session?.user.role === "VIEWER" ? (
        <Card className="border-muted bg-muted/30">
          <CardContent className="flex items-center gap-3 pt-5">
            <Info className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">You have read-only access. Contact an administrator to schedule or update maintenance windows.</p>
          </CardContent>
        </Card>
      ) : (
        <ITMaintenanceForm assets={assets.map((asset) => ({ id: asset.id, name: asset.name, assetTag: asset.assetTag }))} users={users.map((user) => ({ id: user.id, name: user.name }))} />
      )}
      <MaintenanceCalendarTable maintenances={maintenances} />
    </div>
  );
}
