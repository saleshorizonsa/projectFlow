import { ProjectForm } from "@/components/projects/project-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export default async function NewProjectPage() {
  const session = await auth();
  const companies = await getPrisma().company.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Create Project & Current State Shell</CardTitle>
          <CardDescription>Create the project shell, select companies, define dates, priority, budget, and manager before capturing current state.</CardDescription>
        </CardHeader>
      </Card>
      {session?.user.role !== "VIEWER" && <ProjectForm managerId={session?.user.id ?? ""} companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))} />}
    </div>
  );
}
