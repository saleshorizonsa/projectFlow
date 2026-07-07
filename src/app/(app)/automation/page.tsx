import { differenceInCalendarDays, differenceInYears } from "date-fns";
import { Bot, CalendarClock, HardDrive, KeyRound, LifeBuoy } from "lucide-react";
import { RunAutomationButton } from "@/components/automation/run-automation-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { runAutomationEngine } from "@/lib/automation-engine";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/utils";

export default async function AutomationPage() {
  const session = await auth();
  const prisma = getPrisma();
  const now = new Date();
  const [results, breachedTickets, expiringLicenses, lifecycleAssets, dueMaintenances, deliveries] = await Promise.all([
    runAutomationEngine(prisma, now),
    prisma.supportTicket.findMany({
      where: { status: { notIn: ["RESOLVED", "CLOSED"] }, OR: [{ slaBreached: true }, { firstResponseDueAt: { lt: now }, respondedAt: null }, { resolveDueAt: { lt: now } }] },
      include: { company: true, assignedTo: true },
      orderBy: { resolveDueAt: "asc" },
      take: 10,
    }),
    prisma.iTLicense.findMany({ where: { expiryDate: { lte: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000) } }, include: { asset: true, _count: { select: { assignments: true } } }, orderBy: { expiryDate: "asc" }, take: 10 }),
    prisma.iTAsset.findMany({ where: { status: { not: "RETIRED" } }, include: { assignedTo: true }, orderBy: { purchaseDate: "asc" }, take: 25 }),
    prisma.iTMaintenance.findMany({ where: { scheduledAt: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }, status: { notIn: ["COMPLETED", "CANCELLED"] } }, include: { asset: true, responsible: true }, orderBy: { scheduledAt: "asc" }, take: 10 }),
    prisma.alertDelivery.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const lifecycleReview = lifecycleAssets.filter((asset) => differenceInYears(now, asset.purchaseDate) >= asset.lifecycleYears - 1);
  const canRun = session?.user.role === "ADMIN" || session?.user.role === "PROJECT_MANAGER";

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-background to-background">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Automation Center</CardTitle>
              <CardDescription>Automated SLA, renewal, lifecycle, and maintenance controls for the IT department.</CardDescription>
            </div>
            {canRun && <RunAutomationButton />}
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="SLA Breaches" value={breachedTickets.length} icon={LifeBuoy} variant={breachedTickets.length ? "destructive" : "success"} />
        <Metric title="License Renewals" value={expiringLicenses.length} icon={KeyRound} variant={expiringLicenses.length ? "warning" : "success"} />
        <Metric title="Lifecycle Reviews" value={lifecycleReview.length} icon={HardDrive} variant={lifecycleReview.length ? "warning" : "success"} />
        <Metric title="Maintenance Due" value={dueMaintenances.length} icon={CalendarClock} variant={dueMaintenances.length ? "warning" : "success"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Automation Rules</CardTitle>
            <CardDescription>Rules currently active in HorizonMiyaar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((result) => (
              <div key={result.name} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{result.name}</div>
                    <div className="text-sm text-muted-foreground">{result.description}</div>
                  </div>
                  <Badge variant={result.count ? "warning" : "success"}>{result.count}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SLA Watchlist</CardTitle>
            <CardDescription>Tickets needing response, resolution, or escalation.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Ticket</TableHead><TableHead>Company</TableHead><TableHead>Owner</TableHead><TableHead>SLA</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {breachedTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <div className="font-medium">{ticket.ticketNo}</div>
                      <div className="text-xs text-muted-foreground">{ticket.title}</div>
                    </TableCell>
                    <TableCell>{ticket.company.code}</TableCell>
                    <TableCell>{ticket.assignedTo?.name ?? "Unassigned"}</TableCell>
                    <TableCell><Badge variant="destructive">{formatEnum(ticket.priority)}</Badge></TableCell>
                  </TableRow>
                ))}
                {breachedTickets.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No SLA breaches.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <RiskList title="License Renewal Queue" items={expiringLicenses.map((license) => ({ id: license.id, title: license.name, detail: `${license.vendor} / ${license.licenseId}`, badge: `${differenceInCalendarDays(license.expiryDate, now)}d` }))} />
        <RiskList title="Asset Lifecycle Queue" items={lifecycleReview.slice(0, 10).map((asset) => ({ id: asset.id, title: asset.assetTag, detail: `${asset.name} / ${asset.assignedTo?.name ?? "Unassigned"}`, badge: `${asset.lifecycleYears}y` }))} />
        <RiskList title="Maintenance Queue" items={dueMaintenances.map((maintenance) => ({ id: maintenance.id, title: maintenance.maintenanceId, detail: `${maintenance.title} / ${maintenance.asset.assetTag}`, badge: formatEnum(maintenance.status) }))} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Alert Delivery Audit</CardTitle>
          <CardDescription>Email and WhatsApp delivery attempts created by automation.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Alert</TableHead><TableHead>Recipient</TableHead><TableHead>Channel</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>
                    <div className="font-medium">{delivery.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{delivery.error ?? delivery.message}</div>
                  </TableCell>
                  <TableCell>
                    <div>{delivery.user?.name ?? "External"}</div>
                    <div className="text-xs text-muted-foreground">{delivery.recipient}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{formatEnum(delivery.channel)}</Badge></TableCell>
                  <TableCell><Badge variant={delivery.status === "SENT" ? "success" : delivery.status === "FAILED" ? "destructive" : "secondary"}>{formatEnum(delivery.status)}</Badge></TableCell>
                </TableRow>
              ))}
              {deliveries.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No alert delivery attempts yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value, icon: Icon, variant }: { title: string; value: number; icon: typeof Bot; variant: "success" | "warning" | "destructive" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="truncate text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold leading-none">{value}</div>
        <Badge variant={variant}>{variant === "destructive" ? "Escalate" : variant === "warning" ? "Review" : "OK"}</Badge>
      </CardContent>
    </Card>
  );
}

function RiskList({ title, items }: { title: string; items: { id: string; title: string; detail: string; badge: string }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="max-h-[360px] space-y-2 overflow-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{item.title}</div>
              <div className="truncate text-xs text-muted-foreground">{item.detail}</div>
            </div>
            <Badge className="shrink-0" variant="outline">{item.badge}</Badge>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing pending.</p>}
      </CardContent>
    </Card>
  );
}
