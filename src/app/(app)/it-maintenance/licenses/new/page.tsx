import Link from "next/link";
import { Info } from "lucide-react";
import { ITLicenseForm } from "@/components/it-maintenance/it-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { assetCompanyWhere, selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function NewLicensePage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const companyId = await selectedCompanyId(searchParams);
  const assets = await getPrisma().iTAsset.findMany({ where: assetCompanyWhere(companyId), orderBy: { assetTag: "asc" } });
  const isViewer = session?.user.role === "VIEWER";

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Add License</CardTitle>
            <CardDescription>Create a license or subscription record. After creation, only admin users can edit it.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm"><Link href="/it-maintenance/licenses">← Back to Register</Link></Button>
        </CardHeader>
      </Card>
      {isViewer ? (
        <Card className="border-muted bg-muted/30">
          <CardContent className="flex items-center gap-3 pt-5">
            <Info className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">You have read-only access. Contact an administrator to add license records.</p>
          </CardContent>
        </Card>
      ) : (
        <ITLicenseForm assets={assets.map((asset) => ({ id: asset.id, name: asset.name, assetTag: asset.assetTag }))} />
      )}
    </div>
  );
}
