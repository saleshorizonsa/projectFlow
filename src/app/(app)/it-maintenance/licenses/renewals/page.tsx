import { differenceInCalendarDays } from "date-fns";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assetCompanyWhere, selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function LicenseRenewalRisksPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const companyId = await selectedCompanyId(searchParams);
  const now = new Date();
  const licenses = await getPrisma().iTLicense.findMany({
    where: companyId ? { OR: [{ asset: assetCompanyWhere(companyId) }, { assetId: null }] } : {},
    include: {
      _count: { select: { assignments: true } },
      asset: { include: { companies: { include: { company: true } } } },
    },
    orderBy: { expiryDate: "asc" },
  });
  const renewalRisks = licenses.filter((license) => differenceInCalendarDays(license.expiryDate, now) <= 90);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>License Renewal Risks</CardTitle>
            <CardDescription>Licenses expired or expiring within 90 days. These are also surfaced in Gap Management.</CardDescription>
          </div>
          <Button asChild variant="outline"><Link href="/it-maintenance/licenses">Back to Register</Link></Button>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Renewal Queue</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>License</TableHead><TableHead>Owner</TableHead><TableHead>Linked To</TableHead><TableHead>Expiry</TableHead><TableHead>Risk</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {renewalRisks.map((license) => {
                const days = differenceInCalendarDays(license.expiryDate, now);
                return (
                  <TableRow key={license.id}>
                    <TableCell><div className="font-medium">{license.name}</div><div className="text-xs text-muted-foreground">{license.vendor} / {license.licenseId}</div></TableCell>
                    <TableCell>{license.owner}</TableCell>
                    <TableCell>
                      {license.asset
                        ? `${license.asset.assetTag} / ${license.asset.name}`
                        : "Unlinked"}
                      {license._count.assignments > 0 && (
                        <div className="text-xs text-muted-foreground">{license._count.assignments} seat(s) assigned</div>
                      )}
                    </TableCell>
                    <TableCell>{license.expiryDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={days < 0 || days <= 30 ? "destructive" : "warning"}>{days < 0 ? `${Math.abs(days)} days expired` : `${days} days left`}</Badge>
                        <Link href="/it-maintenance/licenses" className="text-xs text-muted-foreground underline-offset-2 hover:underline">Edit</Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {renewalRisks.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No renewal risks in the next 90 days.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
