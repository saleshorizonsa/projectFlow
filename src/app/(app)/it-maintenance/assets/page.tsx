import { ITAssetForm } from "@/components/it-maintenance/it-forms";
import { AssetRegisterTable } from "@/components/it-maintenance/it-maintenance-tables";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { assetCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function ITAssetsPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const prisma = getPrisma();
  const companyId = await selectedCompanyId(searchParams);
  const [assets, users, companies, employees] = await Promise.all([
    prisma.iTAsset.findMany({ where: assetCompanyWhere(companyId), include: { assignedTo: true, employee: true, companies: { include: { company: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: companyId ? { companies: { some: { companyId } } } : {}, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <Card><CardHeader><CardTitle>Assets & Applications</CardTitle><CardDescription>Maintain servers, routers, laptops, applications, databases, and cloud services.</CardDescription></CardHeader></Card>
      {session?.user.role !== "VIEWER" && <ITAssetForm companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))} users={users.map((user) => ({ id: user.id, name: user.name }))} employees={employees.map((employee) => ({ id: employee.id, name: employee.name, employeeId: employee.employeeId }))} />}
      <AssetRegisterTable assets={assets} />
    </div>
  );
}
