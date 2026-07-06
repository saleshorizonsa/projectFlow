"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, CheckCircle2, ChevronRight, Circle, FileUp, XCircle, MinusCircle, RefreshCw } from "lucide-react";

type ControlStatus = "NOT_ASSESSED" | "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT" | "NOT_APPLICABLE";

type Control = {
  id: string;
  controlId: string;
  title: string;
  description: string | null;
  objective: string | null;
  status: ControlStatus;
  implementationNotes: string | null;
  responsible: { id: string; name: string } | null;
  lastAssessedAt: string | null;
  nextReviewAt: string | null;
  evidences: { id: string; fileName: string; fileUrl: string; notes: string | null; createdAt: string }[];
  findings: { id: string; findingId: string; severity: string; status: string }[];
  policyMappings: { id: string; policy: { id: string; title: string; category: string | null; status: string } }[];
};

type Domain = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  order: number;
  controls: Control[];
};

type Framework = {
  id: string;
  code: string;
  name: string;
  version: string | null;
  domains: Domain[];
};

const STATUS_META: Record<ControlStatus, { label: string; icon: React.ReactNode; color: string; badgeVariant: "success" | "warning" | "destructive" | "secondary" | "outline" }> = {
  COMPLIANT:           { label: "Compliant",           icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,  color: "text-green-600",  badgeVariant: "success" },
  PARTIALLY_COMPLIANT: { label: "Partial",             icon: <Circle className="h-4 w-4 text-yellow-500" />,       color: "text-yellow-600", badgeVariant: "warning" },
  NON_COMPLIANT:       { label: "Non-Compliant",       icon: <XCircle className="h-4 w-4 text-red-600" />,         color: "text-red-600",    badgeVariant: "destructive" },
  NOT_ASSESSED:        { label: "Not Assessed",        icon: <Circle className="h-4 w-4 text-muted-foreground" />, color: "text-muted-foreground", badgeVariant: "outline" },
  NOT_APPLICABLE:      { label: "N/A",                 icon: <MinusCircle className="h-4 w-4 text-muted-foreground" />, color: "text-muted-foreground", badgeVariant: "secondary" },
};

function domainScore(domain: Domain): { compliant: number; total: number; pct: number } {
  const applicable = domain.controls.filter(c => c.status !== "NOT_APPLICABLE");
  const compliant = applicable.filter(c => c.status === "COMPLIANT").length;
  const total = applicable.length;
  return { compliant, total, pct: total === 0 ? 0 : Math.round((compliant / total) * 100) };
}

function overallScore(framework: Framework): { compliant: number; total: number; pct: number } {
  const allControls = framework.domains.flatMap(d => d.controls);
  const applicable = allControls.filter(c => c.status !== "NOT_APPLICABLE");
  const compliant = applicable.filter(c => c.status === "COMPLIANT").length;
  const total = applicable.length;
  return { compliant, total, pct: total === 0 ? 0 : Math.round((compliant / total) * 100) };
}

function ControlDetailDialog({ control, onUpdated }: { control: Control; onUpdated: () => void }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<ControlStatus>(control.status);
  const [notes, setNotes] = useState(control.implementationNotes ?? "");
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await fetch(`/api/compliance/controls/${control.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, implementationNotes: notes, lastAssessedAt: new Date().toISOString() }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onUpdated();
    });
  }

  const openFindings = control.findings.filter(f => f.status === "OPEN" || f.status === "IN_PROGRESS");

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-mono text-muted-foreground">{control.controlId}</p>
        <h2 className="text-lg font-semibold mt-0.5">{control.title}</h2>
        {control.objective && <p className="mt-2 text-sm text-muted-foreground">{control.objective}</p>}
        {control.description && <p className="mt-1 text-xs text-muted-foreground">{control.description}</p>}
      </div>

      {openFindings.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-xs font-semibold text-destructive mb-1">{openFindings.length} open finding{openFindings.length > 1 ? "s" : ""}</p>
          {openFindings.map(f => (
            <div key={f.id} className="text-xs text-muted-foreground flex gap-2">
              <Badge variant={f.severity === "CRITICAL" ? "destructive" : "warning"} className="text-[10px] px-1">{f.severity}</Badge>
              <span>{f.findingId}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3">
        <div className="grid gap-1">
          <Label>Compliance Status</Label>
          <Select value={status} onValueChange={v => setStatus(v as ControlStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_META) as ControlStatus[]).map(s => (
                <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label>Implementation Notes</Label>
          <textarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe how this control is implemented, partial gaps, compensating controls…"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={pending}>{pending ? "Saving…" : saved ? "Saved ✓" : "Save Assessment"}</Button>
        </div>
      </div>

      {control.evidences.length > 0 && (
        <div>
          <Label className="mb-2 block">Evidence Files ({control.evidences.length})</Label>
          <div className="space-y-1">
            {control.evidences.map(e => (
              <div key={e.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <span className="truncate">{e.fileName}</span>
                <a href={e.fileUrl} target="_blank" rel="noopener noreferrer" className="ml-2 shrink-0 text-xs text-blue-600 hover:underline">View</a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label className="mb-2 flex items-center gap-1.5 block">
          <BookOpen className="h-3.5 w-3.5 text-violet-600" />
          Linked Policies
          {control.policyMappings.length > 0 && (
            <Badge variant="secondary" className="ml-1">{control.policyMappings.length}</Badge>
          )}
        </Label>
        {control.policyMappings.length === 0 ? (
          <p className="text-xs text-muted-foreground">No policies mapped to this control yet.</p>
        ) : (
          <div className="space-y-1">
            {control.policyMappings.map(({ id, policy }) => (
              <div key={id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="truncate font-medium">{policy.title}</span>
                  {policy.category && <span className="ml-2 text-xs text-muted-foreground">{policy.category}</span>}
                </div>
                <Badge
                  variant={policy.status === "APPROVED" ? "success" : policy.status === "UNDER_REVIEW" ? "warning" : "secondary"}
                  className="ml-2 shrink-0 text-[10px]"
                >
                  {policy.status.replace(/_/g, " ")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompliancePage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [activeFramework, setActiveFramework] = useState<string>("");
  const [selectedControl, setSelectedControl] = useState<Control | null>(null);
  const [controlDialogOpen, setControlDialogOpen] = useState(false);

  function load() {
    fetch("/api/compliance/frameworks").then(r => r.json()).then((data: Framework[]) => {
      setFrameworks(data);
      if (data.length > 0 && !activeFramework) setActiveFramework(data[0].id);
    }).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  const framework = frameworks.find(f => f.id === activeFramework);
  const score = framework ? overallScore(framework) : null;

  const allControls = framework ? framework.domains.flatMap(d => d.controls) : [];
  const nonCompliantControls = allControls.filter(c => c.status === "NON_COMPLIANT");
  const notAssessed = allControls.filter(c => c.status === "NOT_ASSESSED").length;
  const overdueReviews = allControls.filter(c => c.nextReviewAt && new Date(c.nextReviewAt) < new Date()).length;

  function openControl(c: Control) {
    setSelectedControl(c);
    setControlDialogOpen(true);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Cybersecurity Compliance Dashboard</CardTitle>
            <CardDescription>Track control compliance against SACS-210 and ISO 27001:2022. Click any control to update its status and add implementation notes.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {nonCompliantControls.length > 0 && <Badge variant="destructive">{nonCompliantControls.length} non-compliant</Badge>}
            {overdueReviews > 0 && <Badge variant="warning">{overdueReviews} review overdue</Badge>}
            {notAssessed > 0 && <Badge variant="outline">{notAssessed} not assessed</Badge>}
            <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
      </Card>

      {frameworks.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading frameworks…</CardContent></Card>
      )}

      {frameworks.length > 0 && (
        <Tabs value={activeFramework} onValueChange={setActiveFramework} className="space-y-4">
          <TabsList>
            {frameworks.map(f => <TabsTrigger key={f.id} value={f.id}>{f.code}</TabsTrigger>)}
          </TabsList>

          {frameworks.map(fw => {
            const fwScore = overallScore(fw);
            return (
              <TabsContent key={fw.id} value={fw.id} className="space-y-4">
                {/* Overall score card */}
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-3">
                          <span className="text-4xl font-bold">{fwScore.pct}%</span>
                          <span className="text-muted-foreground text-sm">compliance score</span>
                        </div>
                        <Progress value={fwScore.pct} className="mt-2 h-3" />
                        <p className="mt-1 text-xs text-muted-foreground">{fwScore.compliant} of {fwScore.total} applicable controls compliant — {fw.name} {fw.version}</p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm lg:shrink-0">
                        {(Object.keys(STATUS_META) as ControlStatus[]).map(s => {
                          const n = fw.domains.flatMap(d => d.controls).filter(c => c.status === s).length;
                          if (n === 0) return null;
                          return (
                            <div key={s} className="flex items-center gap-1.5">
                              {STATUS_META[s].icon}
                              <span className="font-semibold">{n}</span>
                              <span className="text-muted-foreground">{STATUS_META[s].label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Domain cards */}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {fw.domains.sort((a, b) => a.order - b.order).map(domain => {
                    const ds = domainScore(domain);
                    const hasIssues = domain.controls.some(c => c.status === "NON_COMPLIANT");
                    return (
                      <Card key={domain.id} className={hasIssues ? "border-destructive/40" : ""}>
                        <CardHeader className="pb-2 pt-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-mono text-muted-foreground">{domain.code}</div>
                              <CardTitle className="text-sm mt-0.5">{domain.name}</CardTitle>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className={`text-xl font-bold ${ds.pct === 100 ? "text-green-600" : ds.pct >= 60 ? "text-yellow-600" : "text-red-600"}`}>{ds.pct}%</div>
                              <div className="text-xs text-muted-foreground">{ds.compliant}/{ds.total}</div>
                            </div>
                          </div>
                          <Progress value={ds.pct} className="mt-2 h-1.5" />
                        </CardHeader>
                        <CardContent className="pb-3 space-y-1">
                          {domain.controls.map(c => (
                            <button
                              key={c.id}
                              onClick={() => openControl(c)}
                              className="w-full flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted/60 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {STATUS_META[c.status].icon}
                                <span className="truncate font-medium">{c.controlId}</span>
                                <span className="truncate text-muted-foreground hidden sm:inline">{c.title}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {c.findings.some(f => f.status === "OPEN") && <Badge variant="destructive" className="text-[9px] px-1 py-0">!</Badge>}
                                {c.nextReviewAt && new Date(c.nextReviewAt) < new Date() && (
                                  <Badge variant="warning" className="text-[9px] px-1 py-0" title={`Review overdue since ${new Date(c.nextReviewAt).toLocaleDateString("en-GB")}`}>↻</Badge>
                                )}
                                {c.policyMappings.length > 0 && (
                                  <span title={`${c.policyMappings.length} linked polic${c.policyMappings.length > 1 ? "ies" : "y"}`}>
                                    <BookOpen className="h-3 w-3 text-violet-500" />
                                  </span>
                                )}
                                {c.evidences.length > 0 && <FileUp className="h-3 w-3 text-muted-foreground" />}
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </button>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Control detail dialog */}
      <Dialog open={controlDialogOpen} onOpenChange={setControlDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Control Assessment</DialogTitle>
          </DialogHeader>
          {selectedControl && (
            <ControlDetailDialog
              key={selectedControl.id}
              control={selectedControl}
              onUpdated={() => { load(); setControlDialogOpen(false); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
