import { Building2 } from "lucide-react";
import { CompanyForm } from "@/components/companies/company-form";
import { CompanyTable } from "@/components/companies/company-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export default async function CompaniesPage() {
  const session = await auth();
  const companies = await getPrisma().company.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const companyRows = companies.map((company) => ({
    id: company.id,
    code: company.code,
    name: company.name,
    description: company.description,
    active: company.active,
    _count: company._count,
  }));
  const canManage = session?.user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Company Management</CardTitle>
            <CardDescription>Maintain group companies for shared-services projects, tasks, gaps, reports, and IT work.</CardDescription>
          </div>
          <Building2 className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent><CompanyTable companies={companyRows} canManage={canManage} /></CardContent>
      </Card>
      {canManage && <CompanyForm />}
    </div>
  );
}
