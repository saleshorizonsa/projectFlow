import { GapWorkspace } from "@/components/gaps/gap-workspace";
import Link from "next/link";
import { Plus, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { relatedProjectCompanyWhere, selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function GapsPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const companyId = await selectedCompanyId(searchParams);
  const gaps = await getPrisma().gap.findMany({
    where: relatedProjectCompanyWhere(companyId),
    include: {
      project: { include: { companies: { include: { company: true } } } },
      owner: true,
      layer: true,
      subLayer: true,
      actions: { include: { responsiblePerson: true }, orderBy: { dueDate: "asc" } },
    },
    orderBy: [{ severity: "desc" }, { targetClosureDate: "asc" }],
  });
  const gapRows = gaps.map((gap) => ({
    id: gap.id,
    gapId: gap.gapId,
    title: gap.title,
    description: gap.description,
    severity: gap.severity,
    impact: gap.impact,
    rootCause: gap.rootCause,
    targetClosureDate: gap.targetClosureDate.toISOString(),
    status: gap.status,
    project: {
      name: gap.project.name,
      companies: gap.project.companies.map((link) => ({ id: link.company.id, name: link.company.name, code: link.company.code })),
    },
    owner: { name: gap.owner.name },
    layer: { name: gap.layer.name },
    subLayer: gap.subLayer ? { name: gap.subLayer.name } : null,
    actions: gap.actions.map((action) => ({
      id: action.id,
      actionId: action.actionId,
      correctiveAction: action.correctiveAction,
      status: action.status,
      progress: action.progress,
      dueDate: action.dueDate.toISOString(),
      responsiblePerson: { name: action.responsiblePerson.name },
    })),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Gap Management</CardTitle>
            <CardDescription>Critical gap register, root cause analysis, ownership, and corrective actions.</CardDescription>
          </div>
          {session?.user.role !== "VIEWER" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/gaps/new"><Plus className="h-4 w-4" /> Create Gap</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/gaps/actions/new"><Route className="h-4 w-4" /> Create Action Plan</Link>
              </Button>
            </div>
          )}
        </CardHeader>
      </Card>
      <GapWorkspace gaps={gapRows} />
    </div>
  );
}
