import { TeamForm } from "@/components/team/team-form";
import { TeamTable } from "@/components/team/team-table";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function TeamPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const companyId = await selectedCompanyId(searchParams);
  const [users, companies] = await Promise.all([
    getPrisma().user.findMany({
      where: userCompanyWhere(companyId),
      include: {
        role: true,
        companies: { include: { company: true }, orderBy: { company: { name: "asc" } } },
        assignedAssets: { include: { companies: { include: { company: true } } }, orderBy: { assetTag: "asc" } },
        _count: { select: { assignedTasks: true, gapActions: true, ownedGaps: true } },
      },
      orderBy: { name: "asc" },
    }),
    getPrisma().company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const rows = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name,
    assignedTasks: user._count.assignedTasks,
    gapActions: user._count.gapActions,
    ownedGaps: user._count.ownedGaps,
    companies: user.companies.map((link) => ({ id: link.company.id, name: link.company.name, code: link.company.code })),
    assets: user.assignedAssets.map((asset) => ({
      id: asset.id,
      assetTag: asset.assetTag,
      name: asset.name,
      type: asset.type,
      companies: asset.companies.map((link) => ({ id: link.company.id, name: link.company.name, code: link.company.code })),
    })),
  }));
  const companyOptions = companies.map((company) => ({ id: company.id, name: company.name, code: company.code }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
          <CardDescription>Create team members, assign access roles, and make users available for project accountability.</CardDescription>
        </CardHeader>
      </Card>
      {session?.user.role === "ADMIN" && <TeamForm companies={companyOptions} />}
      <TeamTable users={rows} companies={companyOptions} canManage={session?.user.role === "ADMIN"} />
    </div>
  );
}
