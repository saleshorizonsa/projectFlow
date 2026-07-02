import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/ui/print-button";
import { getPrisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export default async function EmployeeAssetReportPage({ params }: PageProps) {
  const { id } = await params;
  const employee = await getPrisma().employee.findUnique({
    where: { id },
    include: {
      companies: { include: { company: true } },
      assets: { include: { companies: { include: { company: true } } }, orderBy: { assetTag: "asc" } },
      licenses: { include: { asset: true }, orderBy: { expiryDate: "asc" } },
    },
  });
  if (!employee) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm"><Link href="/employees"><ArrowLeft className="h-4 w-4" /> Employees</Link></Button>
        <div className="flex gap-2">
          <Button asChild variant="outline"><a href={`/api/employees/${employee.id}/asset-report.pdf`}><Download className="h-4 w-4" /> PDF</a></Button>
          <PrintButton />
        </div>
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {employee.companies.map((link) =>
                link.company.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={link.id} src={link.company.logoUrl} alt={link.company.name} className="h-10 max-w-[120px] object-contain" />
                ) : (
                  <div key={link.id} className="text-sm font-semibold text-muted-foreground">{link.company.name}</div>
                )
              )}
            </div>
            <CardTitle className="text-right text-base">Employee Asset &amp; License Handover Record</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2">
            <Info label="Employee" value={`${employee.employeeId} / ${employee.name}`} />
            <Info label="Status" value={formatEnum(employee.status)} />
            <Info label="Department" value={employee.department} />
            <Info label="Job Title" value={employee.jobTitle} />
            <Info label="Email" value={employee.email ?? "Not captured"} />
            <Info label="Phone" value={employee.phone ?? "Not captured"} />
            <Info label="Location" value={employee.location ?? "Not captured"} />
            <div>
              <div className="text-xs text-muted-foreground">Companies</div>
              <div className="mt-1 flex flex-wrap gap-1">{employee.companies.map((link) => <Badge key={link.id} variant="outline">{link.company.code}</Badge>)}</div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Assets Provided</h2>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left"><tr><th className="p-2">Asset</th><th className="p-2">Type</th><th className="p-2">Company</th><th className="p-2">Status</th></tr></thead>
                <tbody>
                  {employee.assets.map((asset) => (
                    <tr key={asset.id} className="border-t">
                      <td className="p-2"><div className="font-medium">{asset.assetTag} / {asset.name}</div><div className="text-xs text-muted-foreground">{asset.vendor} / {asset.model}</div></td>
                      <td className="p-2">{formatEnum(asset.type)}</td>
                      <td className="p-2">{asset.companies.map((link) => link.company.code).join(", ")}</td>
                      <td className="p-2">{formatEnum(asset.status)}</td>
                    </tr>
                  ))}
                  {employee.assets.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={4}>No assets assigned.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Licenses Assigned</h2>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left"><tr><th className="p-2">License</th><th className="p-2">Vendor</th><th className="p-2">Linked Asset</th><th className="p-2">Expiry</th></tr></thead>
                <tbody>
                  {employee.licenses.map((license) => (
                    <tr key={license.id} className="border-t">
                      <td className="p-2"><div className="font-medium">{license.licenseId} / {license.name}</div></td>
                      <td className="p-2">{license.vendor}</td>
                      <td className="p-2">{license.asset ? `${license.asset.assetTag} / ${license.asset.name}` : "Unlinked"}</td>
                      <td className="p-2">{license.expiryDate.toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {employee.licenses.length === 0 && <tr><td className="p-3 text-muted-foreground" colSpan={4}>No licenses assigned.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-8 pt-8 sm:grid-cols-2">
            <Signature label="Employee Signature" />
            <Signature label="IT Signature" />
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value}</div></div>;
}

function Signature({ label }: { label: string }) {
  return <div><div className="border-b pb-8" /><div className="mt-2 text-sm text-muted-foreground">{label}</div></div>;
}
