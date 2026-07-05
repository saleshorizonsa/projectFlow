import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { differenceInYears } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/ui/print-button";
import { getPrisma } from "@/lib/prisma";
import { generateQrDataUrl } from "@/lib/qrcode";
import { formatEnum } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export default async function AssetDetailPage({ params }: PageProps) {
  const { id } = await params;

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const pageUrl = `${proto}://${host}/api/public/asset-pdf/${id}`;
  const qrDataUrl = await generateQrDataUrl(pageUrl);

  const asset = await getPrisma().iTAsset.findUnique({
    where: { id },
    include: {
      assignedTo: true,
      employee: true,
      companies: { include: { company: true } },
      licenses: { orderBy: { expiryDate: "asc" } },
      maintenances: {
        orderBy: { scheduledAt: "desc" },
        take: 10,
        include: { responsible: { select: { name: true } } },
      },
    },
  });
  if (!asset) notFound();

  const ageYears = differenceInYears(new Date(), asset.purchaseDate);
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none">
      {/* Nav — hidden on print */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/it-maintenance/assets"><ArrowLeft className="h-4 w-4" /> Assets</Link>
        </Button>
        <PrintButton label="Print Asset Record" />
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          {/* Header row: companies + title + QR */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Company logos */}
            <div className="flex flex-wrap items-center gap-4">
              {asset.companies.map((link) => (
                <div key={link.id} className="flex items-center gap-2">
                  {link.company.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={link.company.logoUrl} alt={link.company.name} className="h-10 max-w-[100px] object-contain" />
                  )}
                  <div>
                    <div className="text-sm font-bold leading-tight">{link.company.name}</div>
                    <div className="text-xs text-muted-foreground">{link.company.code}</div>
                  </div>
                </div>
              ))}
              {asset.companies.length === 0 && (
                <p className="text-sm text-muted-foreground">No company assigned</p>
              )}
            </div>

            {/* QR code */}
            <div className="flex shrink-0 flex-col items-center gap-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR Code" className="h-[80px] w-[80px] rounded border" />
              <span className="text-[9px] text-muted-foreground">Scan for digital record</span>
            </div>
          </div>

          <div className="mt-3">
            <CardTitle className="text-xl">{asset.assetTag} / {asset.name}</CardTitle>
            <CardDescription>{asset.vendor} · {asset.model} · Printed: {today}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* Section 1 — Asset Details */}
          <section>
            <SectionTitle>1. Asset Details</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Asset Tag" value={asset.assetTag} />
              <Info label="Name" value={asset.name} />
              <Info label="Type" value={formatEnum(asset.type)} />
              <Info label="Vendor" value={asset.vendor} />
              <Info label="Model" value={asset.model} />
              <Info label="Location" value={asset.location} />
              <Info label="Purchase Date" value={asset.purchaseDate.toLocaleDateString("en-GB")} />
              <Info label="Age" value={`${ageYears} year${ageYears !== 1 ? "s" : ""}`} />
              <Info label="Lifecycle" value={`${asset.lifecycleYears} years`} />
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <Badge variant={asset.status === "ACTIVE" ? "success" : "secondary"} className="mt-1">
                  {formatEnum(asset.status)}
                </Badge>
              </div>
              {asset.notes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="text-xs text-muted-foreground">Notes</div>
                  <div className="mt-0.5 text-sm">{asset.notes}</div>
                </div>
              )}
            </div>
          </section>

          {/* Section 2 — Assigned Employee */}
          <section>
            <SectionTitle>2. Assigned Employee</SectionTitle>
            {asset.employee ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Info label="Employee ID" value={asset.employee.employeeId} />
                <Info label="Full Name" value={asset.employee.name} />
                <Info label="Department" value={asset.employee.department} />
                <Info label="Job Title" value={asset.employee.jobTitle} />
                <Info label="Email" value={asset.employee.email ?? "Not captured"} />
                <Info label="Phone" value={asset.employee.phone ?? "Not captured"} />
                <Info label="Location" value={asset.employee.location ?? "Not captured"} />
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <Badge
                    variant={
                      asset.employee.status === "ACTIVE" ? "success"
                      : asset.employee.status === "EXITED" ? "destructive"
                      : asset.employee.status === "ON_LEAVE" ? "warning"
                      : "secondary"
                    }
                    className="mt-1"
                  >
                    {formatEnum(asset.employee.status)}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No employee assigned to this asset.</p>
            )}
          </section>

          {/* Section 3 — IT Custodian */}
          {asset.assignedTo && (
            <section>
              <SectionTitle>3. IT Custodian</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Name" value={asset.assignedTo.name} />
                <Info label="Email" value={asset.assignedTo.email ?? "Not captured"} />
              </div>
            </section>
          )}

          {/* Section 4 — Software Licenses */}
          <section>
            <SectionTitle>{asset.assignedTo ? "4" : "3"}. Software Licenses</SectionTitle>
            {asset.licenses.length > 0 ? (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left">
                    <tr>
                      <th className="p-2">License ID</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Vendor</th>
                      <th className="p-2">Expiry</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asset.licenses.map((lic) => {
                      const expired = new Date(lic.expiryDate) < new Date();
                      return (
                        <tr key={lic.id} className="border-t">
                          <td className="p-2 font-medium">{lic.licenseId}</td>
                          <td className="p-2">{lic.name}</td>
                          <td className="p-2">{lic.vendor}</td>
                          <td className={`p-2 ${expired ? "font-medium text-destructive" : ""}`}>
                            {new Date(lic.expiryDate).toLocaleDateString("en-GB")}
                          </td>
                          <td className="p-2">
                            <Badge variant={expired ? "destructive" : "success"}>
                              {expired ? "Expired" : "Active"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No licenses linked to this asset.</p>
            )}
          </section>

          {/* Section 5 — Maintenance History */}
          <section>
            <SectionTitle>{asset.assignedTo ? "5" : "4"}. Maintenance History</SectionTitle>
            {asset.maintenances.length > 0 ? (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left">
                    <tr>
                      <th className="p-2">ID</th>
                      <th className="p-2">Title</th>
                      <th className="p-2">Scheduled</th>
                      <th className="p-2">Duration</th>
                      <th className="p-2">Responsible</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asset.maintenances.map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="p-2 font-medium">{m.maintenanceId}</td>
                        <td className="p-2">{m.title}</td>
                        <td className="p-2">{new Date(m.scheduledAt).toLocaleDateString("en-GB")}</td>
                        <td className="p-2">{m.durationMinutes} min</td>
                        <td className="p-2">{m.responsible.name}</td>
                        <td className="p-2">
                          <Badge variant={m.status === "COMPLETED" ? "success" : m.status === "IN_PROGRESS" ? "warning" : "secondary"}>
                            {formatEnum(m.status)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No maintenance records on file.</p>
            )}
          </section>

          {/* Signature blocks */}
          <section className="grid gap-10 pt-4 sm:grid-cols-3 print:pt-2">
            <Signature label="Employee" sublabel="I confirm receipt of this asset." />
            <Signature label="IT Custodian" sublabel="Issued by" />
            <Signature label="Manager" sublabel="Approved by" />
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 border-b pb-1 text-base font-semibold">{children}</h2>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Signature({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div>
      <div className="border-b border-gray-400 pb-8 print:border-black" />
      <div className="mt-2 text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{sublabel}</div>
    </div>
  );
}
