import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Palmtree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export default async function EmployeeProfilePage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  const employee = await getPrisma().employee.findUnique({
    where: { id },
    include: {
      companies: { include: { company: true } },
      assets: { orderBy: { assetTag: "asc" } },
      licenses: { orderBy: { name: "asc" } },
      supportTickets: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, ticketNo: true, title: true,
          status: true, priority: true, category: true,
          createdAt: true, resolvedAt: true,
        },
      },
    },
  });

  if (!employee) notFound();

  const canManage = session?.user.role === "ADMIN" || session?.user.role === "PROJECT_MANAGER";
  const openTickets = employee.supportTickets.filter(t => !["RESOLVED", "CLOSED"].includes(t.status));
  const closedTickets = employee.supportTickets.filter(t => ["RESOLVED", "CLOSED"].includes(t.status));

  function statusVariant(s: string) {
    if (s === "ACTIVE") return "success" as const;
    if (s === "EXITED") return "destructive" as const;
    if (s === "ON_LEAVE") return "warning" as const;
    return "secondary" as const;
  }

  function ticketStatusVariant(s: string) {
    if (s === "RESOLVED" || s === "CLOSED") return "secondary" as const;
    if (s === "OPEN" || s === "TRIAGED") return "warning" as const;
    return "secondary" as const;
  }

  function priorityVariant(p: string) {
    if (p === "CRITICAL") return "destructive" as const;
    if (p === "HIGH") return "warning" as const;
    return "secondary" as const;
  }

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/employees"><ArrowLeft className="h-4 w-4" /> All Employees</Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/employees/${id}/asset-report`}><FileText className="h-4 w-4" /> Asset Report</Link>
          </Button>
          {employee.status === "ON_LEAVE" && (
            <Button asChild variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400">
              <Link href={`/employees/${id}/leave-form`}><Palmtree className="h-4 w-4" /> Leave Form</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Header card */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-background to-background">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{employee.name}</CardTitle>
              <CardDescription>{employee.employeeId} · {employee.jobTitle} · {employee.department}</CardDescription>
            </div>
            <Badge variant={statusVariant(employee.status)} className="text-sm">{formatEnum(employee.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Email" value={employee.email ?? "Not captured"} />
            <Info label="Phone" value={employee.phone ?? "Not captured"} />
            <Info label="Location" value={employee.location ?? "Not captured"} />
            <div>
              <div className="text-xs text-muted-foreground">Companies</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {employee.companies.map(l => <Badge key={l.id} variant="outline">{l.company.code}</Badge>)}
              </div>
            </div>
            {employee.ipAddress && <Info label="IP Address" value={employee.ipAddress} />}
            {employee.vpnUserId && <Info label="VPN User" value={employee.vpnUserId} />}
          </div>
        </CardContent>
      </Card>

      {/* On Leave banner */}
      {employee.status === "ON_LEAVE" && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="flex flex-wrap items-center gap-4 pt-4">
            <Palmtree className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">Currently on leave</p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {employee.leaveReason ?? "No reason specified"}
                {employee.leaveStartDate && ` · From ${new Date(employee.leaveStartDate).toLocaleDateString("en-GB")}`}
                {employee.leaveReturnDate && ` · Returns ${new Date(employee.leaveReturnDate).toLocaleDateString("en-GB")}`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exit banner */}
      {employee.status === "EXITED" && employee.exitDate && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="font-medium text-destructive">Offboarded — {new Date(employee.exitDate).toLocaleDateString("en-GB")}</p>
            {employee.offboardingNotes && <p className="mt-1 text-sm text-muted-foreground">{employee.offboardingNotes}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Assets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">IT Assets</CardTitle>
            <CardDescription>{employee.assets.length} assigned</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag / Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.assets.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.assetTag}</div>
                        <div className="text-xs text-muted-foreground">{a.name}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{formatEnum(a.type)}</Badge></TableCell>
                      <TableCell><Badge variant={a.status === "ACTIVE" ? "success" : "secondary"}>{formatEnum(a.status)}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {employee.assets.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No assets assigned.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Licenses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Software Licenses</CardTitle>
            <CardDescription>{employee.licenses.length} assigned</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>License</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.licenses.map(l => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.licenseId}</div>
                        <div className="text-xs text-muted-foreground">{l.name}</div>
                      </TableCell>
                      <TableCell>{l.vendor}</TableCell>
                      <TableCell className={new Date(l.expiryDate) < new Date() ? "text-destructive font-medium" : ""}>
                        {new Date(l.expiryDate).toLocaleDateString("en-GB")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {employee.licenses.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No licenses assigned.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Open tickets */}
      {openTickets.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Open Support Tickets
              <Badge variant="warning">{openTickets.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TicketTable tickets={openTickets} ticketStatusVariant={ticketStatusVariant} priorityVariant={priorityVariant} />
          </CardContent>
        </Card>
      )}

      {/* Ticket history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Support Ticket History</CardTitle>
          <CardDescription>{employee.supportTickets.length} total tickets</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {employee.supportTickets.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No support tickets on record.</p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <TicketTable tickets={employee.supportTickets} ticketStatusVariant={ticketStatusVariant} priorityVariant={priorityVariant} />
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/employees">Back to Employee Directory</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function TicketTable({
  tickets,
  ticketStatusVariant,
  priorityVariant,
}: {
  tickets: { id: string; ticketNo: string; title: string; status: string; priority: string; category: string; createdAt: Date; resolvedAt?: Date | null }[];
  ticketStatusVariant: (s: string) => "success" | "destructive" | "secondary" | "warning";
  priorityVariant: (p: string) => "success" | "destructive" | "secondary" | "warning";
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticket</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Opened</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map(t => (
          <TableRow key={t.id}>
            <TableCell>
              <div className="font-medium">{t.ticketNo}</div>
              <div className="max-w-[220px] truncate text-xs text-muted-foreground">{t.title}</div>
            </TableCell>
            <TableCell><Badge variant="outline">{formatEnum(t.category)}</Badge></TableCell>
            <TableCell><Badge variant={priorityVariant(t.priority)}>{formatEnum(t.priority)}</Badge></TableCell>
            <TableCell><Badge variant={ticketStatusVariant(t.status)}>{formatEnum(t.status)}</Badge></TableCell>
            <TableCell className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("en-GB")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
