import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { SupportTicketDesk } from "@/components/support/support-ticket-desk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { assetCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function NewSupportTicketPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const prisma = getPrisma();
  const companyId = await selectedCompanyId(searchParams);
  const [companies, employees, assets, licenses, users] = await Promise.all([
    prisma.company.findMany({ where: companyId ? { id: companyId, active: true } : { active: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: companyId ? { companies: { some: { companyId } } } : {}, include: { companies: { include: { company: true } } }, orderBy: { name: "asc" } }),
    prisma.iTAsset.findMany({ where: assetCompanyWhere(companyId), include: { companies: { include: { company: true } } }, orderBy: { name: "asc" } }),
    prisma.iTLicense.findMany({ where: companyId ? { OR: [{ asset: assetCompanyWhere(companyId) }, { assetId: null }] } : {}, include: { asset: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
  ]);

  const isViewer = session?.user.role === "VIEWER";

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Log Support Ticket</CardTitle>
            <CardDescription>Create a support request and link it to company, employee, asset, or license.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm"><Link href="/support"><ArrowLeft className="mr-1 h-4 w-4" />Back to Support</Link></Button>
        </CardHeader>
      </Card>
      {isViewer ? (
        <Card className="border-muted bg-muted/30">
          <CardContent className="flex items-center gap-3 pt-5">
            <Info className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">You have read-only access. Contact an administrator to log support tickets.</p>
          </CardContent>
        </Card>
      ) : (
        <SupportTicketDesk
          tickets={[]}
          companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))}
          employees={employees.map((employee) => ({ id: employee.id, name: `${employee.employeeId} / ${employee.name}`, companyIds: employee.companies.map((link) => link.companyId) }))}
          assets={assets.map((asset) => ({ id: asset.id, name: `${asset.assetTag} / ${asset.name}`, companyIds: asset.companies.map((link) => link.companyId) }))}
          licenses={licenses.map((license) => ({ id: license.id, name: license.asset ? `${license.name} / ${license.asset.assetTag}` : license.name }))}
          users={users.map((user) => ({ id: user.id, name: user.name }))}
          showTickets={false}
        />
      )}
    </div>
  );
}
