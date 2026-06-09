import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GapForm } from "@/components/gaps/gap-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { projectCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export default async function NewGapPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  await requireRole("TEAM_MEMBER");
  const companyId = await selectedCompanyId(searchParams);
  const [users, projects] = await Promise.all([
    getPrisma().user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
    getPrisma().project.findMany({
      where: projectCompanyWhere(companyId),
      include: {
        currentState: true,
        companies: { include: { company: true }, orderBy: { company: { name: "asc" } } },
        layers: { include: { subLayers: { orderBy: { order: "asc" } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const userOptions = users.map((user) => ({ id: user.id, name: user.name }));
  const projectOptions = projects.map((project) => ({
    id: project.id,
    name: project.companies.length > 0
      ? `${project.name} (${project.companies.map((link) => link.company.code).join(", ")})`
      : project.name,
    currentState: project.currentState ? {
      summary: project.currentState.summary,
      currentProcess: project.currentState.currentProcess,
      painPoints: project.currentState.painPoints,
      risks: project.currentState.risks,
      constraints: project.currentState.constraints,
      confidenceLevel: project.currentState.confidenceLevel,
    } : null,
    layers: project.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      subLayers: layer.subLayers.map((subLayer) => ({ id: subLayer.id, name: subLayer.name })),
    })),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Create Gap</CardTitle>
            <CardDescription>Log a new gap, assign ownership, and let impact calculate from severity.</CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/gaps"><ArrowLeft className="h-4 w-4" /> Back to Register</Link>
          </Button>
        </CardHeader>
      </Card>
      <GapForm projects={projectOptions} users={userOptions} />
    </div>
  );
}
