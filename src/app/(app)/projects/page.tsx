import { ProjectForm } from "@/components/projects/project-form";
import { ProjectTable } from "@/components/projects/project-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { projectCompanyWhere, selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function ProjectsPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const companyId = await selectedCompanyId(searchParams);
  const [projects, companies] = await Promise.all([
    getPrisma().project.findMany({
      where: projectCompanyWhere(companyId),
      include: {
        manager: true,
        companies: { include: { company: true }, orderBy: { company: { name: "asc" } } },
        _count: { select: { tasks: true, gaps: true, milestones: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    getPrisma().company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const projectRows = projects.map((project) => ({
    id: project.id,
    projectId: project.projectId,
    name: project.name,
    description: project.description,
    client: project.client,
    companies: project.companies.map((link) => ({ id: link.company.id, name: link.company.name, code: link.company.code })),
    status: project.status,
    priority: project.priority,
    startDate: project.startDate.toISOString(),
    endDate: project.endDate.toISOString(),
    budget: Number(project.budget),
    manager: { name: project.manager.name },
    _count: project._count,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Management</CardTitle>
          <CardDescription>Plan, prepare, execute, and monitor accountable project delivery.</CardDescription>
        </CardHeader>
        <CardContent><ProjectTable data={projectRows} companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))} /></CardContent>
      </Card>
      {session?.user.role !== "VIEWER" && (
        <ProjectForm managerId={session?.user.id ?? ""} companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))} />
      )}
    </div>
  );
}
