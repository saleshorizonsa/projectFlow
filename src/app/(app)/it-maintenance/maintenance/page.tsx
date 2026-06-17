import { ITMaintenanceForm } from "@/components/it-maintenance/it-forms";
import { MaintenanceCalendarTable } from "@/components/it-maintenance/it-maintenance-tables";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { assetCompanyWhere, relatedAssetCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function ITMaintenanceWindowsPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const prisma = getPrisma();
  const companyId = await selectedCompanyId(searchParams);
  const [assets, maintenances, users] = await Promise.all([
    prisma.iTAsset.findMany({ where: assetCompanyWhere(companyId), orderBy: { assetTag: "asc" } }),
    prisma.iTMaintenance.findMany({ where: relatedAssetCompanyWhere(companyId), include: { asset: { include: { assignedTo: true, employee: true, companies: { include: { company: true } } } }, responsible: true }, orderBy: { scheduledAt: "asc" } }),
    prisma.user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <Card><CardHeader><CardTitle>Maintenance Windows</CardTitle><CardDescription>Plan upgrades, patch windows, downtime, and owner accountability.</CardDescription></CardHeader></Card>
      {session?.user.role !== "VIEWER" && <ITMaintenanceForm assets={assets.map((asset) => ({ id: asset.id, name: asset.name, assetTag: asset.assetTag }))} users={users.map((user) => ({ id: user.id, name: user.name }))} />}
      <MaintenanceCalendarTable maintenances={maintenances} />
    </div>
  );
}
