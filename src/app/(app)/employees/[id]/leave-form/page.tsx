import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/ui/print-button";
import { getPrisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export default async function EmployeeLeaveFormPage({ params }: PageProps) {
  const { id } = await params;
  const employee = await getPrisma().employee.findUnique({
    where: { id },
    include: {
      companies: { include: { company: true } },
      assets: { orderBy: { assetTag: "asc" } },
      licenses: { orderBy: { expiryDate: "asc" } },
      supportTickets: {
        where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
        select: { id: true, ticketNo: true, title: true, status: true, priority: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!employee) notFound();

  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="mx-auto max-w-4xl space-y-4 print:max-w-none print:space-y-3">
      {/* Nav — hidden when printing */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/employees"><ArrowLeft className="h-4 w-4" /> Employees</Link>
        </Button>
        <PrintButton label="Print Form" />
      </div>

      <Card className="print:border-none print:shadow-none">
        <CardHeader className="border-b pb-4 print:pb-3">
          {/* Logo row */}
          {employee.companies.some((l) => l.company.logoUrl) && (
            <div className="mb-3 flex flex-wrap items-center gap-4 border-b pb-3">
              {employee.companies.map((link) =>
                link.company.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={link.id} src={link.company.logoUrl} alt={link.company.name} className="h-10 max-w-[140px] object-contain" />
                ) : null
              )}
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Employee Leave Authorization Form</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Ref: {employee.employeeId} — Printed: {today}</p>
            </div>
            <Badge
              variant={employee.status === "ON_LEAVE" ? "warning" : employee.status === "ACTIVE" ? "success" : "secondary"}
              className="shrink-0 text-sm"
            >
              {formatEnum(employee.status)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5 print:pt-4">

          {/* Section 1 — Employee Details */}
          <section>
            <SectionTitle>1. Employee Details</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <Info label="Full Name" value={employee.name} />
              <Info label="Employee ID" value={employee.employeeId} />
              <Info label="Department" value={employee.department} />
              <Info label="Job Title" value={employee.jobTitle} />
              <Info label="Email" value={employee.email ?? "Not captured"} />
              <Info label="Phone" value={employee.phone ?? "Not captured"} />
              <Info label="Location" value={employee.location ?? "Not captured"} />
              <div>
                <div className="text-xs text-muted-foreground">Companies</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {employee.companies.map(link => (
                    <Badge key={link.id} variant="outline">{link.company.code} — {link.company.name}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Section 2 — Leave Details */}
          <section>
            <SectionTitle>2. Leave Details</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-3">
              <Info label="Leave Type" value={employee.leaveReason?.split(" — ")[0] ?? "Not specified"} />
              <Info label="Start Date" value={employee.leaveStartDate ? new Date(employee.leaveStartDate).toLocaleDateString("en-GB") : "Not set"} />
              <Info label="Expected Return" value={employee.leaveReturnDate ? new Date(employee.leaveReturnDate).toLocaleDateString("en-GB") : "Not set"} />
            </div>
            {employee.leaveReason?.includes(" — ") && (
              <div className="mt-2">
                <div className="text-xs text-muted-foreground">Notes</div>
                <div className="mt-0.5 text-sm">{employee.leaveReason.split(" — ").slice(1).join(" — ")}</div>
              </div>
            )}
          </section>

          {/* Section 3 — Asset Clearance */}
          <section>
            <SectionTitle>3. IT Asset Clearance</SectionTitle>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-2">Asset Tag</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-center">Returned?</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.assets.map(asset => (
                    <tr key={asset.id} className="border-t">
                      <td className="p-2 font-medium">{asset.assetTag}</td>
                      <td className="p-2">{asset.name}<div className="text-xs text-muted-foreground">{asset.vendor} / {asset.model}</div></td>
                      <td className="p-2">{formatEnum(asset.type)}</td>
                      <td className="p-2"><Badge variant="secondary">{formatEnum(asset.status)}</Badge></td>
                      <td className="p-2 text-center"><Checkbox /></td>
                    </tr>
                  ))}
                  {employee.assets.length === 0 && (
                    <tr><td className="p-3 text-muted-foreground" colSpan={5}>No assets assigned — clearance not required.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4 — License Clearance */}
          <section>
            <SectionTitle>4. Software License Clearance</SectionTitle>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-2">License ID</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Vendor</th>
                    <th className="p-2">Expiry</th>
                    <th className="p-2 text-center">Freed?</th>
                  </tr>
                </thead>
                <tbody>
                  {employee.licenses.map(lic => (
                    <tr key={lic.id} className="border-t">
                      <td className="p-2 font-medium">{lic.licenseId}</td>
                      <td className="p-2">{lic.name}</td>
                      <td className="p-2">{lic.vendor}</td>
                      <td className="p-2">{new Date(lic.expiryDate).toLocaleDateString("en-GB")}</td>
                      <td className="p-2 text-center"><Checkbox /></td>
                    </tr>
                  ))}
                  {employee.licenses.length === 0 && (
                    <tr><td className="p-3 text-muted-foreground" colSpan={5}>No licenses assigned — clearance not required.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 5 — Open Tickets */}
          {employee.supportTickets.length > 0 && (
            <section>
              <SectionTitle>5. Open Support Tickets (Requires Reassignment)</SectionTitle>
              <div className="overflow-hidden rounded-md border border-amber-200">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 text-left dark:bg-amber-950/30">
                    <tr>
                      <th className="p-2">Ticket #</th>
                      <th className="p-2">Title</th>
                      <th className="p-2">Priority</th>
                      <th className="p-2">Status</th>
                      <th className="p-2 text-center">Reassigned?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employee.supportTickets.map(ticket => (
                      <tr key={ticket.id} className="border-t">
                        <td className="p-2 font-medium">{ticket.ticketNo ?? "—"}</td>
                        <td className="p-2">{ticket.title}</td>
                        <td className="p-2">{formatEnum(ticket.priority)}</td>
                        <td className="p-2">{formatEnum(ticket.status)}</td>
                        <td className="p-2 text-center"><Checkbox /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section 6 — Sign-offs */}
          <section className="grid gap-10 pt-4 sm:grid-cols-3 print:pt-2">
            <Signature label="Employee" sublabel="I confirm the above details are accurate." />
            <Signature label="Line Manager" sublabel="Approved by" />
            <Signature label="IT / HR" sublabel="Clearance confirmed by" />
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

function Checkbox() {
  return (
    <div className="mx-auto h-5 w-5 rounded border border-gray-400 print:border-black" />
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
