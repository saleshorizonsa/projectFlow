import { GapWorkspace } from "@/components/gaps/gap-workspace";
import { differenceInCalendarDays } from "date-fns";
import Link from "next/link";
import { KeyRound, Plus, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { assetCompanyWhere, relatedProjectCompanyWhere, selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function GapsPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const companyId = await selectedCompanyId(searchParams);
  const prisma = getPrisma();
  const [gaps, licenses] = await Promise.all([
    prisma.gap.findMany({
    where: relatedProjectCompanyWhere(companyId),
    include: {
      project: { include: { companies: { include: { company: true } } } },
      owner: true,
      layer: true,
      subLayer: true,
      actions: { include: { responsiblePerson: true }, orderBy: { dueDate: "asc" } },
    },
    orderBy: [{ severity: "desc" }, { targetClosureDate: "asc" }],
    }),
    prisma.iTLicense.findMany({
      where: companyId ? { OR: [{ asset: assetCompanyWhere(companyId) }, { employee: { companies: { some: { companyId } } } }, { assetId: null, employeeId: null }] } : {},
      include: { asset: true, employee: true },
      orderBy: { expiryDate: "asc" },
    }),
  ]);
  const now = new Date();
  const licenseGaps = licenses.filter((license) => differenceInCalendarDays(license.expiryDate, now) <= 90);
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> License Renewal Gaps</CardTitle>
          <CardDescription>License expiries are shown here as operational gaps so renewal risk is visible with project and corrective-action gaps.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>License Gap</TableHead><TableHead>Owner</TableHead><TableHead>Linked To</TableHead><TableHead>Target Closure</TableHead><TableHead>Severity</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {licenseGaps.map((license) => {
                const days = differenceInCalendarDays(license.expiryDate, now);
                const severity = days < 0 || days <= 30 ? "CRITICAL" : days <= 60 ? "HIGH" : "MEDIUM";
                return (
                  <TableRow key={license.id}>
                    <TableCell>
                      <div className="font-medium">Renew {license.name}</div>
                      <div className="text-xs text-muted-foreground">{license.vendor} / {license.licenseId}</div>
                    </TableCell>
                    <TableCell>{license.owner}</TableCell>
                    <TableCell>{license.asset ? `${license.asset.assetTag} / ${license.asset.name}` : license.employee ? `${license.employee.employeeId} / ${license.employee.name}` : "Unlinked"}</TableCell>
                    <TableCell>
                      <div>{license.expiryDate.toLocaleDateString()}</div>
                      <div className="text-xs text-muted-foreground">{days < 0 ? `${Math.abs(days)} days expired` : `${days} days left`}</div>
                    </TableCell>
                    <TableCell><Badge variant={severity === "CRITICAL" ? "destructive" : "warning"}>{severity}</Badge></TableCell>
                  </TableRow>
                );
              })}
              {licenseGaps.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No license renewal gaps in the next 90 days.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <GapWorkspace gaps={gapRows} />
    </div>
  );
}
