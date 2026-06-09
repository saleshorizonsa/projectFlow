import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeTable } from "@/components/employees/employee-table";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function EmployeesPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const companyId = await selectedCompanyId(searchParams);
  const [employees, companies] = await Promise.all([
    getPrisma().employee.findMany({
      where: companyId ? { companies: { some: { companyId } } } : {},
      include: {
        companies: { include: { company: true }, orderBy: { company: { name: "asc" } } },
        assets: { orderBy: { assetTag: "asc" } },
        licenses: { orderBy: { expiryDate: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    getPrisma().company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const companyOptions = companies.map((company) => ({ id: company.id, name: company.name, code: company.code }));
  const rows = employees.map((employee) => ({
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    jobTitle: employee.jobTitle,
    location: employee.location,
    status: employee.status,
    companies: employee.companies.map((link) => ({ id: link.company.id, name: link.company.name, code: link.company.code })),
    assets: employee.assets.map((asset) => ({ id: asset.id, assetTag: asset.assetTag, name: asset.name, type: asset.type })),
    licenses: employee.licenses.map((license) => ({ id: license.id, licenseId: license.licenseId, name: license.name, vendor: license.vendor })),
  }));
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "PROJECT_MANAGER";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Employee Management</CardTitle>
          <CardDescription>Maintain employees by company and connect issued assets, licenses, and IT maintenance records.</CardDescription>
        </CardHeader>
      </Card>
      {canManage && <EmployeeForm companies={companyOptions} />}
      <EmployeeTable employees={rows} companies={companyOptions} canManage={canManage} />
    </div>
  );
}
