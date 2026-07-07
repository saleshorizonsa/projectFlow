import { ITLicenseForm } from "@/components/it-maintenance/it-forms";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { assetCompanyWhere, selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function NewLicensePage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const companyId = await selectedCompanyId(searchParams);
  const assets = await getPrisma().iTAsset.findMany({ where: assetCompanyWhere(companyId), orderBy: { assetTag: "asc" } });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Add License</CardTitle>
          <CardDescription>Create a license or subscription record. After creation, only admin users can edit it.</CardDescription>
        </CardHeader>
      </Card>
      {session?.user.role !== "VIEWER" && <ITLicenseForm assets={assets.map((asset) => ({ id: asset.id, name: asset.name, assetTag: asset.assetTag }))} />}
    </div>
  );
}
