import Link from "next/link";
import { CsvImportDialog } from "@/components/csv-import/csv-import-dialog";
import { ITLicenseForm } from "@/components/it-maintenance/it-forms";
import { LicensePoolTable } from "@/components/it-maintenance/license-pool-table";
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
    prisma.iTAsset.findMany({
      where: assetCompanyWhere(companyId),
      orderBy: { assetTag: "asc" },
    }),
    prisma.iTLicense.findMany({
      where: companyId
        ? { OR: [{ asset: assetCompanyWhere(companyId) }, { assetId: null }] }
        : {},
      include: {
        assignments: {
          include: {
            employee: { select: { id: true, employeeId: true, name: true, department: true } },
          },
          orderBy: { assignedAt: "asc" },
        },
      },
      orderBy: { expiryDate: "asc" },
    }),
    prisma.employee.findMany({
      where: companyId ? { companies: { some: { companyId } } } : {},
      select: { id: true, name: true, employeeId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const poolLicenses = licenses.map((l) => ({
    id: l.id,
    licenseId: l.licenseId,
    name: l.name,
    vendor: l.vendor,
    seats: l.seats,
    cost: Number(l.cost ?? 0),
    expiryDate: l.expiryDate.toISOString(),
    owner: l.owner ?? "",
    assetId: l.assetId ?? null,
    notes: l.notes ?? null,
    assignments: l.assignments.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      assignedAt: a.assignedAt.toISOString(),
      notes: a.notes ?? null,
      employee: {
        id: a.employee.id,
        employeeId: a.employee.employeeId,
        name: a.employee.name,
        department: a.employee.department ?? null,
      },
    })),
  }));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>License Register</CardTitle>
            <CardDescription>Track software licenses, subscriptions, and seat assignments across employees.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {session?.user.role !== "VIEWER" && <CsvImportDialog type="license" />}
            {session?.user.role !== "VIEWER" && <Button asChild><Link href="/it-maintenance/licenses/new">Add License</Link></Button>}
            <Button asChild variant="outline"><Link href="/it-maintenance/licenses/renewals">Renewal Risks</Link></Button>
          </div>
        </CardHeader>
      </Card>
      <LicensePoolTable
        licenses={poolLicenses}
        canManage={session?.user.role === "ADMIN"}
        employees={employees}
        assets={assets.map((a) => ({ id: a.id, name: a.name, assetTag: a.assetTag }))}
      />
    </div>
  );
}
