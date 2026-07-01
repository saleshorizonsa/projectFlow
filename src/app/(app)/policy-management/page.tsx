"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, ChevronRight, Clock, FileText, Plus, RefreshCw, Send, Users } from "lucide-react";

type Policy = {
  id: string;
  policyId: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  version: string;
  fileUrl: string | null;
  fileName: string | null;
  effectiveDate: string | null;
  reviewDate: string | null;
  approver: { id: string; name: string } | null;
  approvedAt: string | null;
  _count: { acknowledgements: number; controls: number };
};

type PolicyDetail = Policy & {
  versions: { id: string; version: string; fileName: string; fileUrl: string; publishedAt: string }[];
  acknowledgements: { id: string; status: string; employee: { id: string; name: string; employeeId: string }; sentAt: string; acknowledgedAt: string | null }[];
  controls: { id: string; control: { id: string; controlId: string; title: string; domain: { name: string; code: string } } }[];
};

const STATUS_VARIANT: Record<string, "secondary" | "warning" | "success" | "outline"> = {
  DRAFT: "secondary", UNDER_REVIEW: "warning", APPROVED: "success", DEPRECATED: "outline",
};

const POLICY_CATEGORIES = [
  "Acceptable Use", "Access Control", "Asset Management", "Backup & Recovery",
  "Change Management", "Data Classification", "Incident Response", "Network Security",
  "Password", "Physical Security", "Privacy", "Risk Management",
  "Supplier Security", "Vulnerability Management", "Remote Work", "Other",
];

function AddPolicyDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ policyId: "", title: "", description: "", category: "Access Control", status: "DRAFT", version: "1.0", fileUrl: "", reviewDate: "" });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, policyId: form.policyId || `POL-${Date.now()}`, reviewDate: form.reviewDate ? new Date(form.reviewDate) : undefined }),
      });
      if (!res.ok) { const b = await res.json().catch(() => null); setError(b?.error ?? "Failed"); return; }
      setOpen(false);
      setForm({ policyId: "", title: "", description: "", category: "Access Control", status: "DRAFT", version: "1.0", fileUrl: "", reviewDate: "" });
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New Policy</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Create Policy</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Policy ID (optional)</Label><Input placeholder="POL-001" value={form.policyId} onChange={e => set("policyId", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Version</Label><Input value={form.version} onChange={e => set("version", e.target.value)} /></div>
          </div>
          <div className="grid gap-1"><Label>Title *</Label><Input value={form.title} onChange={e => set("title", e.target.value)} /></div>
          <div className="grid gap-1"><Label>Description</Label><textarea className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.description} onChange={e => set("description", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{POLICY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["DRAFT", "UNDER_REVIEW", "APPROVED"].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Document URL</Label><Input placeholder="https://…" value={form.fileUrl} onChange={e => set("fileUrl", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Review Date</Label><Input type="date" value={form.reviewDate} onChange={e => set("reviewDate", e.target.value)} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={pending || !form.title}>{pending ? "Saving…" : "Create Policy"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PolicyDetailDialog({ policy, onUpdated }: { policy: Policy; onUpdated: () => void }) {
  const [detail, setDetail] = useState<PolicyDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [sending, startSend] = useTransition();
  const [approving, startApprove] = useTransition();

  function load() {
    fetch(`/api/policies/${policy.id}`).then(r => r.json()).then(setDetail).catch(() => {});
  }

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v) load();
  }

  function sendToAll() {
    if (!detail) return;
    const pendingIds = detail.acknowledgements.filter(a => a.status === "PENDING").map(a => a.employee.id);
    if (pendingIds.length === 0) return;
    startSend(async () => {
      await fetch(`/api/policies/${policy.id}/acknowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeIds: pendingIds }) });
      load();
    });
  }

  function approve() {
    startApprove(async () => {
      await fetch(`/api/policies/${policy.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "APPROVED" }) });
      load();
      onUpdated();
    });
  }

  const ackd = detail?.acknowledgements.filter(a => a.status === "ACKNOWLEDGED").length ?? 0;
  const total = detail?.acknowledgements.length ?? 0;
  const pct = total > 0 ? Math.round((ackd / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs"><ChevronRight className="h-3 w-3" />View</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">{policy.title}</DialogTitle>
        </DialogHeader>
        {!detail ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Tabs defaultValue="overview" className="space-y-3">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="acknowledgements">Acknowledgements ({detail.acknowledgements.length})</TabsTrigger>
              <TabsTrigger value="controls">Controls ({detail.controls.length})</TabsTrigger>
              <TabsTrigger value="versions">Versions ({detail.versions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={STATUS_VARIANT[detail.status]}>{detail.status.replace(/_/g, " ")}</Badge>
                <Badge variant="outline">v{detail.version}</Badge>
                <Badge variant="secondary">{detail.category}</Badge>
              </div>
              {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {detail.effectiveDate && <div><span className="text-muted-foreground">Effective: </span>{new Date(detail.effectiveDate).toLocaleDateString("en-GB")}</div>}
                {detail.reviewDate && <div><span className="text-muted-foreground">Review due: </span><span className={new Date(detail.reviewDate) < new Date() ? "text-destructive font-semibold" : ""}>{new Date(detail.reviewDate).toLocaleDateString("en-GB")}</span></div>}
                {detail.approver && <div><span className="text-muted-foreground">Approver: </span>{detail.approver.name}</div>}
                {detail.approvedAt && <div><span className="text-muted-foreground">Approved: </span>{new Date(detail.approvedAt).toLocaleDateString("en-GB")}</div>}
              </div>
              {detail.fileUrl && <a href={detail.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><FileText className="h-4 w-4" />View Document</a>}
              <div className="flex gap-2 pt-2">
                {detail.status !== "APPROVED" && <Button size="sm" onClick={approve} disabled={approving}>{approving ? "Approving…" : "Approve Policy"}</Button>}
                {detail.status === "APPROVED" && detail.acknowledgements.length > 0 && (
                  <Button size="sm" variant="outline" onClick={sendToAll} disabled={sending}><Send className="mr-2 h-3.5 w-3.5" />{sending ? "Sending…" : "Re-send Pending"}</Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="acknowledgements" className="space-y-3">
              {total > 0 && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{ackd} / {total} acknowledged</span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              )}
              {detail.acknowledgements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employees assigned yet. Use "Send for Acknowledgement" to assign employees.</p>
              ) : (
                <div className="space-y-1">
                  {detail.acknowledgements.map(a => (
                    <div key={a.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{a.employee.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{a.employee.employeeId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.status === "ACKNOWLEDGED" ? (
                          <><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-xs text-muted-foreground">{new Date(a.acknowledgedAt!).toLocaleDateString("en-GB")}</span></>
                        ) : (
                          <><Clock className="h-4 w-4 text-muted-foreground" /><Badge variant="secondary">Pending</Badge></>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="controls" className="space-y-1">
              {detail.controls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No compliance controls mapped to this policy yet.</p>
              ) : (
                detail.controls.map(pc => (
                  <div key={pc.id} className="flex items-center gap-3 rounded border px-3 py-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{pc.control.controlId}</span>
                    <span className="font-medium">{pc.control.title}</span>
                    <Badge variant="outline" className="ml-auto text-xs">{pc.control.domain.code}</Badge>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="versions" className="space-y-1">
              {detail.versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No version history yet.</p>
              ) : (
                detail.versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">v{v.version}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{new Date(v.publishedAt).toLocaleDateString("en-GB")}</span>
                    </div>
                    <a href={v.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">{v.fileName}</a>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SendAckDialog({ policy, onSent }: { policy: Policy; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [employees, setEmployees] = useState<{ id: string; name: string; employeeId: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  function loadEmployees() {
    fetch("/api/employees").then(r => r.json()).then((d: { id: string; name: string; employeeId: string }[]) => setEmployees(d)).catch(() => {});
  }

  function handleOpen(v: boolean) { setOpen(v); if (v) loadEmployees(); }

  function toggleAll() { setSelected(selected.length === employees.length ? [] : employees.map(e => e.id)); }

  function send() {
    startTransition(async () => {
      await fetch(`/api/policies/${policy.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeIds: selected }) });
      setOpen(false);
      setSelected([]);
      onSent();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><Users className="h-3.5 w-3.5" />Send for Acknowledgement</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Send — {policy.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Select employees who must acknowledge this policy:</p>
            <Button size="sm" variant="ghost" onClick={toggleAll} className="text-xs">{selected.length === employees.length ? "Deselect all" : "Select all"}</Button>
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1 rounded-md border p-2">
            {employees.map(e => (
              <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50 text-sm">
                <input type="checkbox" checked={selected.includes(e.id)} onChange={ch => setSelected(p => ch.target.checked ? [...p, e.id] : p.filter(id => id !== e.id))} className="h-4 w-4" />
                <span className="font-medium">{e.name}</span>
                <span className="text-xs text-muted-foreground">{e.employeeId}</span>
              </label>
            ))}
          </div>
          <Button onClick={send} disabled={pending || selected.length === 0} className="w-full">
            <Send className="mr-2 h-4 w-4" />{pending ? "Sending…" : `Send to ${selected.length} employee${selected.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PolicyManagementPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [filter, setFilter] = useState({ status: "", category: "" });

  function load() {
    const p = new URLSearchParams();
    if (filter.status) p.set("status", filter.status);
    if (filter.category) p.set("category", filter.category);
    fetch(`/api/policies?${p}`).then(r => r.json()).then(setPolicies).catch(() => {});
  }

  useEffect(() => { load(); }, [filter.status, filter.category]);

  const draftCount = policies.filter(p => p.status === "DRAFT").length;
  const reviewCount = policies.filter(p => p.status === "UNDER_REVIEW").length;
  const overdueReview = policies.filter(p => p.reviewDate && new Date(p.reviewDate) < new Date() && p.status === "APPROVED").length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Policy Management</CardTitle>
            <CardDescription>Manage the cybersecurity policy library, track versions, map to compliance controls, and collect employee acknowledgements.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {draftCount > 0 && <Badge variant="secondary">{draftCount} draft</Badge>}
            {reviewCount > 0 && <Badge variant="warning">{reviewCount} under review</Badge>}
            {overdueReview > 0 && <Badge variant="destructive">{overdueReview} review overdue</Badge>}
            <AddPolicyDialog onCreated={load} />
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Select value={filter.status || "ALL"} onValueChange={v => setFilter(p => ({ ...p, status: v === "ALL" ? "" : v }))}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>{["ALL", "DRAFT", "UNDER_REVIEW", "APPROVED", "DEPRECATED"].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filter.category || "ALL"} onValueChange={v => setFilter(p => ({ ...p, category: v === "ALL" ? "" : v }))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">All categories</SelectItem>{POLICY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {policies.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <Card><CardContent className="py-12 text-center text-muted-foreground">No policies yet. Create the first policy to start building your policy library.</CardContent></Card>
          </div>
        )}
        {policies.map(p => {
          const isOverdue = p.reviewDate && new Date(p.reviewDate) < new Date() && p.status === "APPROVED";
          return (
            <Card key={p.id} className={isOverdue ? "border-destructive/40" : ""}>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1 mb-1">
                      <Badge variant={STATUS_VARIANT[p.status]}>{p.status.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline">v{p.version}</Badge>
                    </div>
                    <CardTitle className="text-sm leading-snug">{p.title}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{p.category}</CardDescription>
                  </div>
                  <PolicyDetailDialog policy={p} onUpdated={load} />
                </div>
              </CardHeader>
              <CardContent className="pb-3 space-y-2">
                {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {p._count.controls > 0 && <span>{p._count.controls} control{p._count.controls !== 1 ? "s" : ""} mapped</span>}
                  {p._count.acknowledgements > 0 && <span><Users className="inline h-3 w-3 mr-0.5" />{p._count.acknowledgements} recipients</span>}
                  {p.reviewDate && (
                    <span className={isOverdue ? "text-destructive font-semibold" : ""}>
                      Review: {new Date(p.reviewDate).toLocaleDateString("en-GB")}
                    </span>
                  )}
                </div>
                {p.status === "APPROVED" && (
                  <div className="pt-1">
                    <SendAckDialog policy={p} onSent={load} />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
