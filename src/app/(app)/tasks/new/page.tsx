import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TaskForm } from "@/components/tasks/task-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { projectCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export default async function NewTaskPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  await requireRole("TEAM_MEMBER");
  const companyId = await selectedCompanyId(searchParams);
  const [projects, users] = await Promise.all([
    getPrisma().project.findMany({
      where: projectCompanyWhere(companyId),
      include: {
        companies: { include: { company: true }, orderBy: { company: { name: "asc" } } },
        layers: { include: { subLayers: { orderBy: { order: "asc" } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    getPrisma().user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
  ]);
  const projectOptions = projects.map((project) => ({
    id: project.id,
    name: project.companies.length > 0
      ? `${project.name} (${project.companies.map((link) => link.company.code).join(", ")})`
      : project.name,
    layers: project.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      subLayers: layer.subLayers.map((subLayer) => ({ id: subLayer.id, name: subLayer.name })),
    })),
  }));
  const userOptions = users.map((user) => ({ id: user.id, name: user.name }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Create Task</CardTitle>
            <CardDescription>Create a general operational task or a project task with layer, sub layer, assignee, priority, and deadline.</CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/tasks"><ArrowLeft className="h-4 w-4" /> Back to Tasks</Link>
          </Button>
        </CardHeader>
      </Card>
      <TaskForm projects={projectOptions} users={userOptions} />
    </div>
  );
}
