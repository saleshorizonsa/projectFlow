import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { LifeBuoy, MessageCircle, ShieldAlert, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function SupportPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const companyId = await selectedCompanyId(searchParams);
  const tickets = await getPrisma().supportTicket.findMany({
    where: companyId ? { companyId } : {},
    include: { company: true },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    take: 8,
  });
  const openTickets = tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status));
  const criticalTickets = tickets.filter((ticket) => ticket.priority === "CRITICAL" && !["RESOLVED", "CLOSED"].includes(ticket.status));
  const whatsappTickets = tickets.filter((ticket) => ticket.source === "WHATSAPP");
  const waitingTooLong = openTickets.filter((ticket) => differenceInCalendarDays(new Date(), ticket.createdAt) >= 2);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-background to-background">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>IT Support Desk</CardTitle>
              <CardDescription>Overview for support tickets, WhatsApp intake, SLA pressure, and assignment accountability.</CardDescription>
            </div>
            <Badge variant="outline" className="w-fit">Webhook: /api/whatsapp/webhook</Badge>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Open Tickets" value={openTickets.length} icon={LifeBuoy} variant={openTickets.length ? "warning" : "success"} />
        <Metric title="Critical Tickets" value={criticalTickets.length} icon={ShieldAlert} variant={criticalTickets.length ? "destructive" : "success"} />
        <Metric title="WhatsApp Logged" value={whatsappTickets.length} icon={MessageCircle} variant="secondary" />
        <Metric title="Aging 2+ Days" value={waitingTooLong.length} icon={Timer} variant={waitingTooLong.length ? "warning" : "success"} />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <ModuleCard href="/support/new" title="Log Support Ticket" description="Create a new IT request from phone, portal, email, or WhatsApp." />
        <ModuleCard href="/support/tickets" title="Ticket Register" description="Triage, assign, update status, add action notes, and close tickets." />
      </section>

      <Card>
        <CardHeader><CardTitle>Recent Support Load</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate font-medium">{ticket.ticketNo} / {ticket.title}</div>
                <div className="truncate text-xs text-muted-foreground">{ticket.company.code} / {ticket.createdAt.toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <Badge variant={ticket.priority === "CRITICAL" ? "destructive" : ticket.priority === "HIGH" ? "warning" : "secondary"}>{ticket.priority}</Badge>
                <Badge variant="outline">{ticket.status}</Badge>
              </div>
            </div>
          ))}
          {tickets.length === 0 && <p className="text-sm text-muted-foreground">No support tickets found.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function ModuleCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent><Button asChild variant="outline" className="w-full"><Link href={href}>Open page</Link></Button></CardContent>
    </Card>
  );
}

function Metric({ title, value, icon: Icon, variant }: { title: string; value: number; icon: typeof LifeBuoy; variant: "success" | "warning" | "destructive" | "secondary" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="truncate text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold leading-none">{value}</div>
        <Badge variant={variant}>{variant === "destructive" ? "Urgent" : variant === "warning" ? "Review" : variant === "success" ? "OK" : "Track"}</Badge>
      </CardContent>
    </Card>
  );
}
