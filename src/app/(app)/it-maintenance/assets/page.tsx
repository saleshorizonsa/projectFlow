import { ITAssetForm } from "@/components/it-maintenance/it-forms";
import { AssetRegisterTable } from "@/components/it-maintenance/it-maintenance-tables";
import { AssetLifecycleTab } from "@/components/it-maintenance/asset-lifecycle-tab";
import { CsvImportDialog } from "@/components/csv-import/csv-import-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/lib/auth";
import { assetCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";
import { getAssetRecommendations, severityVariant, type AssetRecommendation } from "@/lib/asset-recommendations";
import { formatEnum } from "@/lib/utils";

export default async function ITAssetsPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const prisma = getPrisma();
  const companyId = await selectedCompanyId(searchParams);
  const canManage = session?.user.role !== "VIEWER";

  const [assets, users, companies, employees] = await Promise.all([
    prisma.iTAsset.findMany({
      where: assetCompanyWhere(companyId),
      include: {
        assignedTo: true,
        employee: true,
        companies: { include: { company: true } },
        maintenances: {
          where: { status: "COMPLETED" },
          orderBy: { scheduledAt: "desc" },
          take: 5,
          select: { scheduledAt: true, status: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: companyId ? { companies: { some: { companyId } } } : {}, orderBy: { name: "asc" } }),
  ]);

  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name, code: c.code }));
  const userOptions = users.map((u) => ({ id: u.id, name: u.name }));
  const employeeOptions = employees.map((e) => ({ id: e.id, name: e.name, employeeId: e.employeeId }));

  // Compute recommendations for every asset
  const assetsWithRecs = assets.map((asset) => ({
    ...asset,
    notes: asset.notes ?? null,
    maintenances: asset.maintenances.map((m) => ({ ...m, scheduledAt: m.scheduledAt })),
  }));

  // Assets that have at least one recommendation
  type RecEntry = { assetId: string; assetTag: string; name: string; type: string; recommendations: AssetRecommendation[] };
  const recommendations: RecEntry[] = assetsWithRecs
    .map((a) => ({ assetId: a.id, assetTag: a.assetTag, name: a.name, type: a.type, recommendations: getAssetRecommendations(a) }))
    .filter((r) => r.recommendations.length > 0)
    .sort((a, b) => {
      const order = ["critical", "high", "medium", "low"];
      const topA = a.recommendations[0]?.severity ?? "low";
      const topB = b.recommendations[0]?.severity ?? "low";
      return order.indexOf(topA) - order.indexOf(topB);
    });

  const criticalCount = recommendations.filter((r) => r.recommendations.some((rec) => rec.severity === "critical")).length;
  const highCount = recommendations.filter((r) => r.recommendations.some((rec) => rec.severity === "high")).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Assets & Applications</CardTitle>
            <CardDescription>Maintain servers, routers, laptops, applications, databases, and cloud services.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && <Badge variant="destructive">{criticalCount} critical</Badge>}
            {highCount > 0 && <Badge variant="warning">{highCount} high priority</Badge>}
            {canManage && <CsvImportDialog type="asset" companies={companyOptions} />}
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="register" className="space-y-4">
        <TabsList>
          <TabsTrigger value="register">Asset Register</TabsTrigger>
          {canManage && <TabsTrigger value="add">Add Asset</TabsTrigger>}
          <TabsTrigger value="lifecycle">Lifecycle & Warranty</TabsTrigger>
          <TabsTrigger value="recommendations" className="relative">
            Recommendations
            {recommendations.length > 0 && (
              <Badge variant={criticalCount > 0 ? "destructive" : "warning"} className="ml-2 px-1.5 py-0 text-xs">
                {recommendations.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register">
          <AssetRegisterTable
            assets={assetsWithRecs}
            canManage={canManage}
            companies={companyOptions}
            users={userOptions}
            employees={employeeOptions}
          />
        </TabsContent>

        {canManage && (
          <TabsContent value="add">
            <ITAssetForm companies={companyOptions} users={userOptions} employees={employeeOptions} />
          </TabsContent>
        )}

        <TabsContent value="lifecycle">
          <AssetLifecycleTab assets={assetsWithRecs} />
        </TabsContent>

        <TabsContent value="recommendations">
          {recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                All assets are within lifecycle, assigned, and up-to-date on maintenance.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recommendations.map(({ assetId, assetTag, name, type, recommendations: recs }) => (
                <Card key={assetId} className="overflow-hidden">
                  <CardHeader className="border-b pb-3 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-semibold">{assetTag} — {name}</CardTitle>
                        <CardDescription className="text-xs">{formatEnum(type)}</CardDescription>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {recs.map((r) => (
                          <Badge key={r.type} variant={severityVariant(r.severity)}>{r.label}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="divide-y p-0">
                    {recs.map((r) => (
                      <div key={r.type} className="px-4 py-3">
                        <p className="text-sm text-muted-foreground">{r.detail}</p>
                        <p className="mt-1 text-xs font-medium text-foreground/80">→ {r.action}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
