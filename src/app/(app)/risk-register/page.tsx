"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, RefreshCw } from "lucide-react";

type Risk = {
  id: string;
  riskId: string;
  title: string;
  description: string;
  category: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  treatment: string;
  treatmentPlan: string | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualScore: number | null;
  status: string;
  dueDate: string | null;
  notes: string | null;
  owner: { id: string; name: string } | null;
  asset: { id: string; assetTag: string; name: string } | null;
  control: { id: string; controlId: string; title: string } | null;
  createdAt: string;
};

const TREATMENT_COLORS: Record<string, "destructive" | "warning" | "secondary" | "outline"> = {
  MITIGATE: "warning",
  ACCEPT: "secondary",
  TRANSFER: "outline",
  AVOID: "destructive",
};

const STATUS_COLORS: Record<string, "destructive" | "warning" | "success" | "secondary" | "outline"> = {
  OPEN: "destructive",
  UNDER_TREATMENT: "warning",
  RESIDUAL: "secondary",
  CLOSED: "outline",
};

const RISK_CATEGORIES = [
  "Cybersecurity", "Operational", "Compliance & Regulatory", "Third Party / Supply Chain",
  "Physical Security", "Business Continuity", "Data Protection", "Financial", "Reputational", "Other",
];

function scoreColor(score: number): string {
  if (score >= 15) return "bg-red-600 text-white";
  if (score >= 10) return "bg-orange-500 text-white";
  if (score >= 5) return "bg-yellow-400 text-black";
  return "bg-green-500 text-white";
}

function scoreLabel(score: number): string {
  if (score >= 15) return "CRITICAL";
  if (score >= 10) return "HIGH";
  if (score >= 5) return "MEDIUM";
  return "LOW";
}

function RiskMatrix({ risks }: { risks: Risk[] }) {
  const cellRisks = (l: number, i: number) => risks.filter(r => r.likelihood === l && r.impact === i && r.status !== "CLOSED");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Risk Heat Map (Inherent)</CardTitle>
        <CardDescription>Likelihood × Impact — open risks only</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="w-20 p-1 text-right text-muted-foreground">L \ I →</th>
                {[1, 2, 3, 4, 5].map(i => (
                  <th key={i} className="w-24 p-1 text-center font-medium">{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[5, 4, 3, 2, 1].map(l => (
                <tr key={l}>
                  <td className="p-1 text-right text-muted-foreground font-medium">{l}</td>
                  {[1, 2, 3, 4, 5].map(i => {
                    const score = l * i;
                    const cellItems = cellRisks(l, i);
                    return (
                      <td key={i} className={`border p-1 text-center min-h-12 align-top ${scoreColor(score)}`}>
                        <div className="text-[10px] font-bold opacity-60">{score}</div>
                        {cellItems.map(r => (
                          <div key={r.id} className="mt-0.5 truncate rounded bg-white/20 px-1 text-[10px] leading-tight" title={r.title}>
                            {r.riskId}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-600" /> Critical (15–25)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-orange-500" /> High (10–12)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-yellow-400" /> Medium (5–9)</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-500" /> Low (1–4)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddRiskDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    riskId: "", title: "", description: "", category: "Cybersecurity",
    likelihood: "3", impact: "3", treatment: "MITIGATE", treatmentPlan: "",
    status: "OPEN", notes: "", dueDate: "",
  });

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          riskId: form.riskId || `RSK-${Date.now()}`,
          likelihood: Number(form.likelihood),
          impact: Number(form.impact),
          dueDate: form.dueDate ? new Date(form.dueDate) : undefined,
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => null); setError(b?.error ?? "Failed"); return; }
      setOpen(false);
      setForm({ riskId: "", title: "", description: "", category: "Cybersecurity", likelihood: "3", impact: "3", treatment: "MITIGATE", treatmentPlan: "", status: "OPEN", notes: "", dueDate: "" });
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Risk</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Register New Risk</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-1">
            <Label>Risk ID (optional)</Label>
            <Input placeholder="RSK-001" value={form.riskId} onChange={e => set("riskId", e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={v => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RISK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1 md:col-span-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} />
          </div>
          <div className="grid gap-1 md:col-span-2">
            <Label>Description *</Label>
            <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Likelihood (1–5)</Label>
            <Select value={form.likelihood} onValueChange={v => set("likelihood", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[["1", "1 – Rare"], ["2", "2 – Unlikely"], ["3", "3 – Possible"], ["4", "4 – Likely"], ["5", "5 – Almost Certain"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Impact (1–5)</Label>
            <Select value={form.impact} onValueChange={v => set("impact", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[["1", "1 – Negligible"], ["2", "2 – Minor"], ["3", "3 – Moderate"], ["4", "4 – Major"], ["5", "5 – Catastrophic"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Treatment</Label>
            <Select value={form.treatment} onValueChange={v => set("treatment", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[["MITIGATE", "Mitigate"], ["ACCEPT", "Accept"], ["TRANSFER", "Transfer / Insure"], ["AVOID", "Avoid"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[["OPEN", "Open"], ["UNDER_TREATMENT", "Under Treatment"], ["RESIDUAL", "Residual"], ["CLOSED", "Closed"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1 md:col-span-2">
            <Label>Treatment Plan</Label>
            <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.treatmentPlan} onChange={e => set("treatmentPlan", e.target.value)} placeholder="Describe the planned or active treatment…" />
          </div>
          <div className="grid gap-1">
            <Label>Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
          <div className="md:col-span-2">
            <Button onClick={submit} disabled={pending || !form.title || !form.description}>
              {pending ? "Saving…" : "Register Risk"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RiskRegisterPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [filter, setFilter] = useState({ status: "", category: "" });

  function load() {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    fetch(`/api/risks?${params}`).then(r => r.json()).then(setRisks).catch(() => {});
  }

  useEffect(() => { load(); }, [filter.status]);

  const filtered = risks.filter(r => !filter.category || r.category === filter.category);

  const openRisks = risks.filter(r => r.status !== "CLOSED");
  const criticalCount = openRisks.filter(r => r.riskScore >= 15).length;
  const highCount = openRisks.filter(r => r.riskScore >= 10 && r.riskScore < 15).length;

  async function closeRisk(id: string) {
    await fetch(`/api/risks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CLOSED" }) });
    load();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Enterprise Risk Register</CardTitle>
            <CardDescription>Identify, assess, and track treatment of cybersecurity and operational risks. Linked to IT assets and compliance controls.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && <Badge variant="destructive">{criticalCount} critical</Badge>}
            {highCount > 0 && <Badge variant="warning">{highCount} high</Badge>}
            <AddRiskDialog onCreated={load} />
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Risk Register</TabsTrigger>
          <TabsTrigger value="matrix">Heat Map</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Select value={filter.status || "ALL"} onValueChange={v => setFilter(p => ({ ...p, status: v === "ALL" ? "" : v }))}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                {["ALL", "OPEN", "UNDER_TREATMENT", "RESIDUAL", "CLOSED"].map(s => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filter.category || "ALL"} onValueChange={v => setFilter(p => ({ ...p, category: v === "ALL" ? "" : v }))}>
              <SelectTrigger className="w-52"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {RISK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Risk</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-center">L×I</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead>Treatment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No risks match the current filters. Use "Add Risk" to register the first risk.</TableCell></TableRow>
                    )}
                    {filtered.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{r.title}</div>
                          <div className="text-xs text-muted-foreground font-mono">{r.riskId}</div>
                          {r.control && <div className="text-xs text-muted-foreground">Control: {r.control.controlId}</div>}
                          {r.asset && <div className="text-xs text-muted-foreground">Asset: {r.asset.assetTag}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{r.category}</TableCell>
                        <TableCell className="text-center text-sm">{r.likelihood}×{r.impact}</TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${scoreColor(r.riskScore)}`}>
                            {r.riskScore} {scoreLabel(r.riskScore)}
                          </span>
                        </TableCell>
                        <TableCell><Badge variant={TREATMENT_COLORS[r.treatment]}>{r.treatment}</Badge></TableCell>
                        <TableCell><Badge variant={STATUS_COLORS[r.status]}>{r.status.replace("_", " ")}</Badge></TableCell>
                        <TableCell className="text-sm">{r.owner?.name ?? "—"}</TableCell>
                        <TableCell>
                          {r.status !== "CLOSED" && (
                            <Button size="sm" variant="ghost" className="text-xs" onClick={() => closeRisk(r.id)}>Close</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix">
          <RiskMatrix risks={risks} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
