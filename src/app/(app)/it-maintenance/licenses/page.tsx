import Link from "next/link";
import { LicenseExpiryTable } from "@/components/it-maintenance/it-maintenance-tables";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { assetCompanyWhere, selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function ITLicensesPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const prisma = getPrisma();
  const companyId = await selectedCompanyId(searchParams);
  const [assets, licenses, employees] = await Promise.all([
    prisma.iTAsset.findMany({ where: assetCompanyWhere(companyId), orderBy: { assetTag: "asc" } }),
    prisma.iTLicense.findMany({ where: companyId ? { OR: [{ asset: assetCompanyWhere(companyId) }, { assetId: null }, { employee: { companies: { some: { companyId } } } }] } : {}, include: { employee: true, asset: { include: { assignedTo: true, employee: true, companies: { include: { company: true } } } } }, orderBy: { expiryDate: "asc" } }),
    prisma.employee.findMany({ where: companyId ? { companies: { some: { companyId } } } : {}, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>License Register</CardTitle>
            <CardDescription>Track software licenses, subscriptions, assigned employees, and renewal ownership.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {session?.user.role !== "VIEWER" && <Button asChild><Link href="/it-maintenance/licenses/new">Add License</Link></Button>}
            <Button asChild variant="outline"><Link href="/it-maintenance/licenses/renewals">Renewal Risks</Link></Button>
          </div>
        </CardHeader>
      </Card>
      <LicenseExpiryTable
        licenses={licenses}
        canManage={session?.user.role === "ADMIN"}
        assets={assets.map((asset) => ({ id: asset.id, name: asset.name, assetTag: asset.assetTag }))}
        employees={employees.map((employee) => ({ id: employee.id, name: employee.name, employeeId: employee.employeeId }))}
      />
    </div>
  );
}
