"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { AttachmentSection } from "@/components/attachments/attachment-section";
import { CommentSection } from "@/components/comments/comment-section";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supportTicketSchema } from "@/lib/validators";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { formatEnum } from "@/lib/utils";

type TicketValues = z.infer<typeof supportTicketSchema>;
type Option = { id: string; name: string };
type CompanyOption = Option & { code: string };
type ScopedOption = Option & { companyIds: string[] };
type Ticket = {
  id: string;
  ticketNo: string;
  title: string;
  description: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  employeeId: string | null;
  employeeName: string | null;
  assetId: string | null;
  assetName: string | null;
  licenseId: string | null;
  licenseName: string | null;
  category: TicketValues["category"];
  priority: TicketValues["priority"];
  status: TicketValues["status"];
  source: TicketValues["source"];
  requesterName: string | null;
  requesterPhone: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  firstResponseDueAt: string | null;
  resolveDueAt: string | null;
  respondedAt: string | null;
  slaBreached: boolean;
  whatsappFrom: string | null;
  createdAt: string;
  updatedAt: string;
  events: { id: string; body: string; direction: string; source: string; authorName: string | null; createdAt: string }[];
};

const categories: TicketValues["category"][] = ["HARDWARE", "SOFTWARE", "NETWORK", "ACCESS", "EMAIL", "ERP", "LICENSE", "MAINTENANCE", "OTHER"];
const priorities: TicketValues["priority"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: TicketValues["status"][] = ["OPEN", "TRIAGED", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"];
const sources: TicketValues["source"][] = ["PORTAL", "WHATSAPP", "PHONE", "EMAIL"];

export function SupportTicketDesk({
  tickets,
  companies,
  employees,
  assets,
  licenses,
  users,
  showForm = true,
  showTickets = true,
  currentUserId = "",
  currentUserRole = "VIEWER",
}: {
  tickets: Ticket[];
  companies: CompanyOption[];
  employees: ScopedOption[];
  assets: ScopedOption[];
  licenses: Option[];
  users: Option[];
  showForm?: boolean;
  showTickets?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const defaultCompanyId = companies[0]?.id ?? "";
  const form = useForm<TicketValues>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: {
      title: "",
      description: "",
      companyId: defaultCompanyId,
      employeeId: "",
      assetId: "",
      licenseId: "",
      category: "OTHER",
      priority: "MEDIUM",
      status: "OPEN",
      source: "PORTAL",
      requesterName: "",
      requesterPhone: "",
      assignedToId: "",
    },
  });
  useUnsavedChangesWarning(form.formState.isDirty);
  const selectedCompanyId = form.watch("companyId") || defaultCompanyId;
  const filteredEmployees = useMemo(() => employees.filter((employee) => employee.companyIds.includes(selectedCompanyId)), [employees, selectedCompanyId]);
  const filteredAssets = useMemo(() => assets.filter((asset) => asset.companyIds.includes(selectedCompanyId)), [assets, selectedCompanyId]);

  async function onSubmit(values: TicketValues) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/support-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Ticket could not be created.");
        return;
      }
      setMessage("Support ticket created.");
      form.reset({ title: "", description: "", companyId: selectedCompanyId, employeeId: "", assetId: "", licenseId: "", category: "OTHER", priority: "MEDIUM", status: "OPEN", source: "PORTAL", requesterName: "", requesterPhone: "", assignedToId: "" });
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
      {showForm && <Card className={showTickets ? "h-fit" : "h-fit xl:col-span-2"}>
        <CardHeader>
          <CardTitle>Log Ticket</CardTitle>
          <CardDescription>Create requests from calls, walk-ins, email, or manual WhatsApp entry.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            <Field label="Title" id="title"><Input id="title" placeholder="Laptop cannot connect to Wi-Fi" {...form.register("title")} /></Field>
            <Field label="Description" id="description"><Input id="description" placeholder="What happened, who is affected, and business impact" {...form.register("description")} /></Field>
            <Picker label="Company" value={form.watch("companyId")} onValueChange={(value) => form.setValue("companyId", value, { shouldValidate: true })} items={companies.map((company) => ({ value: company.id, label: `${company.code} / ${company.name}` }))} />
            <Picker label="Employee" value={form.watch("employeeId") ?? ""} onValueChange={(value) => form.setValue("employeeId", value)} items={[{ value: "none", label: "No employee" }, ...filteredEmployees.map((employee) => ({ value: employee.id, label: employee.name }))]} />
            <Picker label="Asset / Application" value={form.watch("assetId") ?? ""} onValueChange={(value) => form.setValue("assetId", value)} items={[{ value: "none", label: "No asset" }, ...filteredAssets.map((asset) => ({ value: asset.id, label: asset.name }))]} />
            <Picker label="License" value={form.watch("licenseId") ?? ""} onValueChange={(value) => form.setValue("licenseId", value)} items={[{ value: "none", label: "No license" }, ...licenses.map((license) => ({ value: license.id, label: license.name }))]} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Picker label="Category" value={form.watch("category")} onValueChange={(value) => form.setValue("category", value as TicketValues["category"])} items={categories.map(enumItem)} />
              <Picker label="Priority" value={form.watch("priority")} onValueChange={(value) => form.setValue("priority", value as TicketValues["priority"])} items={priorities.map(enumItem)} />
              <Picker label="Source" value={form.watch("source")} onValueChange={(value) => form.setValue("source", value as TicketValues["source"])} items={sources.map(enumItem)} />
              <Picker label="Assign To" value={form.watch("assignedToId") ?? ""} onValueChange={(value) => form.setValue("assignedToId", value)} items={[{ value: "none", label: "Unassigned" }, ...users.map((user) => ({ value: user.id, label: user.name }))]} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Requester" id="requesterName"><Input id="requesterName" placeholder="Name if not employee" {...form.register("requesterName")} /></Field>
              <Field label="Phone / WhatsApp" id="requesterPhone"><Input id="requesterPhone" placeholder="+966..." {...form.register("requesterPhone")} /></Field>
            </div>
            {form.formState.errors.companyId && <p className="text-sm text-destructive">{form.formState.errors.companyId.message}</p>}
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <Button disabled={pending || companies.length === 0}>{pending ? "Creating..." : "Create ticket"}</Button>
          </form>
        </CardContent>
      </Card>}

      {showTickets && <div className={showForm ? "space-y-3" : "space-y-3 xl:col-span-2"}>
        {tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} users={users} currentUserId={currentUserId} currentUserRole={currentUserRole} />)}
        {tickets.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">No support tickets found for this company filter.</CardContent>
          </Card>
        )}
      </div>}
    </div>
  );
}

function TicketCard({ ticket, users, currentUserId, currentUserRole }: { ticket: Ticket; users: Option[]; currentUserId: string; currentUserRole: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<TicketValues["status"]>(ticket.status);
  const [priority, setPriority] = useState<TicketValues["priority"]>(ticket.priority);
  const [assignedToId, setAssignedToId] = useState(ticket.assignedToId ?? "");
  const [eventBody, setEventBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [waReply, setWaReply] = useState("");
  const [waMessage, setWaMessage] = useState<string | null>(null);
  const [waSending, setWaSending] = useState(false);

  function updateTicket() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/support-tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, priority, assignedToId, eventBody }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(body?.error ?? "Ticket update failed.");
        return;
      }
      setEventBody("");
      router.refresh();
    });
  }

  async function sendWhatsAppReply() {
    if (!waReply.trim()) return;
    setWaSending(true);
    setWaMessage(null);
    const res = await fetch(`/api/support-tickets/${ticket.id}/whatsapp-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: waReply.trim() }),
    });
    if (res.ok) {
      setWaReply("");
      setWaMessage("Sent via WhatsApp.");
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setWaMessage(body?.error ?? "WhatsApp send failed.");
    }
    setWaSending(false);
  }

  function deleteTicket() {
    if (!window.confirm(`Delete ${ticket.ticketNo}?`)) return;
    startTransition(async () => {
      const response = await fetch(`/api/support-tickets/${ticket.id}`, { method: "DELETE" });
      if (!response.ok) {
        setMessage("Ticket delete failed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{ticket.ticketNo}</Badge>
              <Badge variant={ticket.priority === "CRITICAL" ? "destructive" : ticket.priority === "HIGH" ? "warning" : "secondary"}>{formatEnum(ticket.priority)}</Badge>
              <Badge variant={ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? "success" : "secondary"}>{formatEnum(ticket.status)}</Badge>
              <Badge variant={ticket.slaBreached ? "destructive" : "outline"}>{ticket.slaBreached ? "SLA Breached" : "SLA Active"}</Badge>
              <Badge variant="outline">{formatEnum(ticket.source)}</Badge>
            </div>
            <CardTitle className="mt-3 text-base">{ticket.title}</CardTitle>
            <CardDescription className="mt-1 break-words">{ticket.description}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={deleteTicket} disabled={pending} aria-label="Delete ticket"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Company" value={`${ticket.companyCode} / ${ticket.companyName}`} />
          <Info label="Employee" value={ticket.employeeName ?? ticket.requesterName ?? "Unassigned"} />
          <Info label="Asset" value={ticket.assetName ?? "Unlinked"} />
          <Info label="License" value={ticket.licenseName ?? "Unlinked"} />
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Info label="First Response SLA" value={ticket.respondedAt ? `Responded ${new Date(ticket.respondedAt).toLocaleString()}` : ticket.firstResponseDueAt ? new Date(ticket.firstResponseDueAt).toLocaleString() : "Not calculated"} />
          <Info label="Resolution SLA" value={ticket.resolveDueAt ? new Date(ticket.resolveDueAt).toLocaleString() : "Not calculated"} />
          <Info label="Assigned To" value={ticket.assignedToName ?? "Unassigned"} />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Picker label="Status" value={status} onValueChange={(value) => setStatus(value as TicketValues["status"])} items={statuses.map(enumItem)} />
          <Picker label="Priority" value={priority} onValueChange={(value) => setPriority(value as TicketValues["priority"])} items={priorities.map(enumItem)} />
          <Picker label="Assign To" value={assignedToId} onValueChange={setAssignedToId} items={[{ value: "none", label: "Unassigned" }, ...users.map((user) => ({ value: user.id, label: user.name }))]} />
          <Field label="Action Note" id={`event-${ticket.id}`}><Input id={`event-${ticket.id}`} value={eventBody} onChange={(event) => setEventBody(event.target.value)} placeholder="Update note" /></Field>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">Created {new Date(ticket.createdAt).toLocaleString()} / Updated {new Date(ticket.updatedAt).toLocaleString()}</div>
          <Button onClick={updateTicket} disabled={pending}><MessageSquarePlus className="mr-2 h-4 w-4" />Update ticket</Button>
        </div>
        {message && <p className="text-sm text-destructive">{message}</p>}
        {ticket.events.length > 0 && (
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recent Activity</div>
            <div className="space-y-2">
              {ticket.events.map((event) => (
                <div key={event.id} className="text-sm">
                  <div className="break-words">{event.body}</div>
                  <div className="text-xs text-muted-foreground">{formatEnum(event.direction)} / {formatEnum(event.source)} / {event.authorName ?? "System"} / {new Date(event.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {ticket.whatsappFrom && (
          <div className="space-y-2 rounded-md border border-green-200 bg-green-50/40 p-3 dark:border-green-900 dark:bg-green-950/20">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400">Reply via WhatsApp → {ticket.whatsappFrom}</p>
            <Textarea
              value={waReply}
              onChange={(e) => setWaReply(e.target.value)}
              placeholder="Type your WhatsApp reply…"
              rows={3}
              className="resize-none text-sm"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={sendWhatsAppReply} disabled={waSending || !waReply.trim()}>
                <Send className="mr-2 h-3 w-3" />{waSending ? "Sending…" : "Send"}
              </Button>
              {waMessage && <p className="text-xs text-muted-foreground">{waMessage}</p>}
            </div>
          </div>
        )}
        <CommentSection
          entityType="supportTicket"
          entityId={ticket.id}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
        <AttachmentSection
          entityType="supportTicket"
          entityId={ticket.id}
          canDelete={["ADMIN", "PROJECT_MANAGER"].includes(currentUserRole)}
        />
      </CardContent>
    </Card>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function Picker({ label, value, onValueChange, items }: { label: string; value: string; onValueChange: (value: string) => void; items: { value: string; label: string }[] }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || "none"} onValueChange={(next) => onValueChange(next === "none" ? "" : next)}>
        <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
        <SelectContent>{items.map((item) => <SelectItem key={item.value || "none"} value={item.value || "none"}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  );
}

function enumItem(value: string) {
  return { value, label: formatEnum(value) };
}
