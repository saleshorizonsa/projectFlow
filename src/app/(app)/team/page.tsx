import Link from "next/link";
import { TeamTable } from "@/components/team/team-table";
import { Button } from "@/components/ui/button";
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
    phone: user.phone,
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
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Team Management</CardTitle>
            <CardDescription>Assign access roles and make users available for project, gap, support, and maintenance accountability.</CardDescription>
          </div>
          {session?.user.role === "ADMIN" && <Button asChild><Link href="/team/new">Add Team Member</Link></Button>}
        </CardHeader>
      </Card>
      <TeamTable users={rows} companies={companyOptions} canManage={session?.user.role === "ADMIN"} />
    </div>
  );
}
