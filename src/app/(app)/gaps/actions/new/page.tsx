import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GapActionForm } from "@/components/gaps/gap-action-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { relatedProjectCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export default async function NewGapActionPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  await requireRole("TEAM_MEMBER");
  const companyId = await selectedCompanyId(searchParams);
  const [gaps, users] = await Promise.all([
    getPrisma().gap.findMany({ where: relatedProjectCompanyWhere(companyId), orderBy: [{ severity: "desc" }, { targetClosureDate: "asc" }] }),
    getPrisma().user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
  ]);
  const gapOptions = gaps.map((gap) => ({ id: gap.id, label: `${gap.gapId} / ${gap.title}` }));
  const userOptions = users.map((user) => ({ id: user.id, name: user.name }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Create Action Plan</CardTitle>
            <CardDescription>Assign corrective action, responsible person, due date, status, and progress for an existing gap.</CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/gaps"><ArrowLeft className="h-4 w-4" /> Back to Register</Link>
          </Button>
        </CardHeader>
      </Card>
      <GapActionForm gaps={gapOptions} users={userOptions} />
    </div>
  );
}
