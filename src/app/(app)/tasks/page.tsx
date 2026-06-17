import { TaskBoard } from "@/components/tasks/task-board";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { relatedProjectCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function TasksPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const companyId = await selectedCompanyId(searchParams);
  const tasks = await getPrisma().task.findMany({
    where: companyId
      ? { OR: [relatedProjectCompanyWhere(companyId), { taskType: "GENERAL", assignee: userCompanyWhere(companyId) }] }
      : {},
    include: { project: { include: { companies: { include: { company: true } } } }, assignee: true, layer: true, subLayer: true },
    orderBy: { dueDate: "asc" },
  });
  const taskRows = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate.toISOString(),
    estimatedHours: Number(task.estimatedHours),
    actualHours: Number(task.actualHours),
    taskType: task.taskType,
    project: task.project ? {
      name: task.project.name,
      companies: task.project.companies.map((link) => ({ id: link.company.id, name: link.company.name, code: link.company.code })),
    } : null,
    assignee: { name: task.assignee.name },
    layer: task.layer ? { name: task.layer.name } : null,
    subLayer: task.subLayer ? { name: task.subLayer.name } : null,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Task Management</CardTitle>
            <CardDescription>Kanban, list, calendar, and Gantt views for general operations and project execution.</CardDescription>
          </div>
          {session?.user.role !== "VIEWER" && (
            <Button asChild>
              <Link href="/tasks/new"><Plus className="h-4 w-4" /> Create Task</Link>
            </Button>
          )}
        </CardHeader>
      </Card>
      <TaskBoard tasks={taskRows} />
    </div>
  );
}
