import { SupportTicketDesk } from "@/components/support/support-ticket-desk";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assetCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function NewSupportTicketPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const prisma = getPrisma();
  const companyId = await selectedCompanyId(searchParams);
  const [companies, employees, assets, licenses, users] = await Promise.all([
    prisma.company.findMany({ where: companyId ? { id: companyId, active: true } : { active: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: companyId ? { companies: { some: { companyId } } } : {}, include: { companies: { include: { company: true } } }, orderBy: { name: "asc" } }),
    prisma.iTAsset.findMany({ where: assetCompanyWhere(companyId), include: { companies: { include: { company: true } } }, orderBy: { name: "asc" } }),
    prisma.iTLicense.findMany({ where: companyId ? { OR: [{ asset: assetCompanyWhere(companyId) }, { assetId: null }] } : {}, include: { asset: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Log Support Ticket</CardTitle>
          <CardDescription>Create a support request and link it to company, employee, asset, or license.</CardDescription>
        </CardHeader>
      </Card>
      <SupportTicketDesk
        tickets={[]}
        companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))}
        employees={employees.map((employee) => ({ id: employee.id, name: `${employee.employeeId} / ${employee.name}`, companyIds: employee.companies.map((link) => link.companyId) }))}
        assets={assets.map((asset) => ({ id: asset.id, name: `${asset.assetTag} / ${asset.name}`, companyIds: asset.companies.map((link) => link.companyId) }))}
        licenses={licenses.map((license) => ({ id: license.id, name: license.asset ? `${license.name} / ${license.asset.assetTag}` : license.name }))}
        users={users.map((user) => ({ id: user.id, name: user.name }))}
        showTickets={false}
      />
    </div>
  );
}
