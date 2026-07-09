"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { BellRing, Plus, Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EVENT_TYPES = [
  "LOGIN_SUCCESS", "LOGIN_FAILURE", "LOGIN_LOCKOUT",
  "MFA_ENABLED", "MFA_DISABLED", "PASSWORD_CHANGED",
  "USER_CREATED", "USER_DELETED", "ROLE_CHANGED",
  "ASSET_CREATED", "ASSET_MODIFIED", "ASSET_DELETED",
  "EMPLOYEE_CREATED", "EMPLOYEE_MODIFIED", "EMPLOYEE_EXITED",
  "VULNERABILITY_OPENED", "VULNERABILITY_ESCALATED",
  "INCIDENT_CREATED", "INCIDENT_ESCALATED",
  "CONFIG_CHANGED", "POLICY_CHANGED", "SUSPICIOUS_ACTIVITY",
];

const MITRE_TACTICS = [
  "Initial Access", "Execution", "Persistence", "Privilege Escalation",
  "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement",
  "Collection", "Exfiltration", "Command and Control", "Impact",
];

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const INCIDENT_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

type AlertRule = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  eventType: string;
  conditionCount: number;
  conditionWindowMin: number;
  severity: string;
  action: string;
  incidentTitle: string | null;
  incidentSeverity: string | null;
  mitreTactic: string | null;
  mitreTechnique: string | null;
  lastFiredAt: string | null;
};

type RuleForm = {
  name: string;
  description: string;
  eventType: string;
  conditionCount: string;
  conditionWindowMin: string;
  severity: string;
  action: string;
  incidentTitle: string;
  incidentSeverity: string;
  mitreTactic: string;
  mitreTechnique: string;
};

const BLANK_FORM: RuleForm = {
  name: "", description: "", eventType: "LOGIN_FAILURE",
  conditionCount: "5", conditionWindowMin: "10",
  severity: "HIGH", action: "CREATE_INCIDENT",
  incidentTitle: "", incidentSeverity: "HIGH",
  mitreTactic: "", mitreTechnique: "",
};

function typeLabel(t: string) { return t.replace(/_/g, " "); }

export default function AlertRulesPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AlertRule | null>(null);
  const [form, setForm] = useState<RuleForm>(BLANK_FORM);
  const [pending, startTransition] = useTransition();

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/alert-rules");
    if (res.ok) setRules(await res.json());
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(BLANK_FORM);
    setDialogOpen(true);
  }

  function openEdit(rule: AlertRule) {
    setEditTarget(rule);
    setForm({
      name: rule.name,
      description: rule.description ?? "",
      eventType: rule.eventType,
      conditionCount: String(rule.conditionCount),
      conditionWindowMin: String(rule.conditionWindowMin),
      severity: rule.severity,
      action: rule.action,
      incidentTitle: rule.incidentTitle ?? "",
      incidentSeverity: rule.incidentSeverity ?? "HIGH",
      mitreTactic: rule.mitreTactic ?? "",
      mitreTechnique: rule.mitreTechnique ?? "",
    });
    setDialogOpen(true);
  }

  function set(k: keyof RuleForm, v: string) {
    setForm(p => ({ ...p, [k]: v }));
  }

  function submit() {
    startTransition(async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        eventType: form.eventType,
        conditionCount: parseInt(form.conditionCount, 10) || 1,
        conditionWindowMin: parseInt(form.conditionWindowMin, 10) || 60,
        severity: form.severity,
        action: form.action,
        incidentTitle: form.incidentTitle || null,
        incidentSeverity: form.action === "CREATE_INCIDENT" ? form.incidentSeverity || null : null,
        mitreTactic: form.mitreTactic || null,
        mitreTechnique: form.mitreTechnique || null,
      };

      const url = editTarget ? `/api/alert-rules/${editTarget.id}` : "/api/alert-rules";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      if (!res.ok) {
        const b = await res.json().catch(() => null);
        toast.error(b?.error ?? "Failed to save rule");
        return;
      }
      toast.success(editTarget ? "Rule updated" : "Rule created");
      setDialogOpen(false);
      void load();
    });
  }

  function toggleEnabled(rule: AlertRule) {
    startTransition(async () => {
      const res = await fetch(`/api/alert-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (res.ok) {
        toast.success(rule.enabled ? "Rule disabled" : "Rule enabled");
        void load();
      }
    });
  }

  function deleteRule(rule: AlertRule) {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    startTransition(async () => {
      await fetch(`/api/alert-rules/${rule.id}`, { method: "DELETE" });
      toast.success("Rule deleted");
      void load();
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Alert Rules</h1>
          <p className="text-sm text-muted-foreground">
            Define threshold-based rules that automatically open incidents when security events exceed limits.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New Rule
        </Button>
      </div>

      {/* Quick-start templates */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BellRing className="h-4 w-4 text-muted-foreground" /> Common Rule Templates
          </CardTitle>
          <CardDescription className="text-xs">Click to pre-fill the create form with a recommended detection rule.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            { name: "Brute Force Detection", eventType: "LOGIN_FAILURE", conditionCount: "5", conditionWindowMin: "10", severity: "HIGH", mitreTactic: "Credential Access", mitreTechnique: "T1110 - Brute Force", incidentTitle: "[Alert] Brute Force Attempt Detected", incidentSeverity: "HIGH" },
            { name: "Account Lockout Alert", eventType: "LOGIN_LOCKOUT", conditionCount: "1", conditionWindowMin: "60", severity: "HIGH", mitreTactic: "Credential Access", mitreTechnique: "T1078 - Valid Accounts", incidentTitle: "[Alert] Account Locked Out", incidentSeverity: "MEDIUM" },
            { name: "Privilege Escalation", eventType: "ROLE_CHANGED", conditionCount: "1", conditionWindowMin: "60", severity: "HIGH", mitreTactic: "Privilege Escalation", mitreTechnique: "T1078 - Valid Accounts", incidentTitle: "[Alert] Role Change Detected", incidentSeverity: "HIGH" },
            { name: "MFA Disabled Alert", eventType: "MFA_DISABLED", conditionCount: "1", conditionWindowMin: "60", severity: "CRITICAL", mitreTactic: "Defense Evasion", mitreTechnique: "T1556 - Modify Authentication", incidentTitle: "[Alert] MFA Disabled on Account", incidentSeverity: "CRITICAL" },
            { name: "Suspicious Activity", eventType: "SUSPICIOUS_ACTIVITY", conditionCount: "1", conditionWindowMin: "60", severity: "CRITICAL", mitreTactic: "Initial Access", mitreTechnique: "", incidentTitle: "[Alert] Suspicious Activity Detected", incidentSeverity: "CRITICAL" },
          ].map(t => (
            <Button
              key={t.name}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setEditTarget(null);
                setForm({ ...BLANK_FORM, ...t, description: "", conditionCount: t.conditionCount, conditionWindowMin: t.conditionWindowMin });
                setDialogOpen(true);
              }}
            >
              {t.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Rules table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>MITRE</TableHead>
                  <TableHead>Last Fired</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">Loading rules…</TableCell></TableRow>
                )}
                {!loading && rules.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No alert rules yet. Use a template above or create one.</TableCell></TableRow>
                )}
                {rules.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{rule.name}</div>
                      {rule.description && <div className="text-xs text-muted-foreground">{rule.description}</div>}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted rounded px-1 py-0.5">{typeLabel(rule.eventType)}</code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rule.conditionCount}× in {rule.conditionWindowMin}min
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.action === "CREATE_INCIDENT" ? "secondary" : "outline"} className="text-xs">
                        {rule.action === "CREATE_INCIDENT" ? "→ Incident" : "Log Only"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rule.mitreTactic ?? "—"}
                      {rule.mitreTechnique && <div className="text-[10px] opacity-70">{rule.mitreTechnique}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rule.lastFiredAt ? new Date(rule.lastFiredAt).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant={rule.enabled ? "default" : "outline"}
                        className="h-6 px-2 text-xs"
                        onClick={() => toggleEnabled(rule)}
                        disabled={pending}
                      >
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(rule)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteRule(rule)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Alert Rule" : "New Alert Rule"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Rule Name *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Brute Force Detection" />
            </div>
            <div className="grid gap-1">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Optional notes" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Event Type *</Label>
                <Select value={form.eventType} onValueChange={v => set("eventType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label>Event Severity</Label>
                <Select value={form.severity} onValueChange={v => set("severity", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Threshold Condition</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label>Event Count *</Label>
                  <Input type="number" min={1} value={form.conditionCount} onChange={e => set("conditionCount", e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label>Window (minutes) *</Label>
                  <Input type="number" min={1} value={form.conditionWindowMin} onChange={e => set("conditionWindowMin", e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Fire when {form.conditionCount} or more events occur within {form.conditionWindowMin} min.</p>
            </div>

            <div className="grid gap-1">
              <Label>Action</Label>
              <Select value={form.action} onValueChange={v => set("action", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREATE_INCIDENT">Create Incident automatically</SelectItem>
                  <SelectItem value="LOG_ONLY">Log Only (no incident)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.action === "CREATE_INCIDENT" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1 col-span-2">
                  <Label>Incident Title Template</Label>
                  <Input value={form.incidentTitle} onChange={e => set("incidentTitle", e.target.value)} placeholder="[Alert] Brute Force Attempt" />
                </div>
                <div className="grid gap-1">
                  <Label>Incident Severity</Label>
                  <Select value={form.incidentSeverity} onValueChange={v => set("incidentSeverity", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INCIDENT_SEVERITIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">MITRE ATT&CK Mapping</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label>Tactic</Label>
                  <Select value={form.mitreTactic || "none"} onValueChange={v => set("mitreTactic", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select tactic" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {MITRE_TACTICS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label>Technique ID</Label>
                  <Input value={form.mitreTechnique} onChange={e => set("mitreTechnique", e.target.value)} placeholder="e.g. T1110 - Brute Force" />
                </div>
              </div>
            </div>

            <Button onClick={submit} disabled={pending || !form.name || !form.eventType}>
              {pending ? "Saving…" : editTarget ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
