"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check, CheckCircle2, Clock, Cloud, Copy, KeyRound, Loader2, Plug, Radar, RefreshCw, Settings, Shield, Trash2, Wifi, WifiOff } from "lucide-react";
import { WAZUH_INSTALL_COMMANDS, WAZUH_LEVELS, wazuhHookUrl, wazuhOssecConfBlock, wazuhOssecConfVulnBlock } from "@/lib/integrations/wazuh-setup";

// ── Types ─────────────────────────────────────────────────────────────────────

type Integration = {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  tenantId: string | null;
  clientId: string | null;
  config: Record<string, unknown> | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  eventCount: number;
  createdAt: string;
  updatedAt: string;
};

const O365_CONTENT_TYPES = [
  { id: "Audit.AzureActiveDirectory", label: "Azure AD (sign-ins, users, roles)" },
  { id: "Audit.Exchange",             label: "Exchange Online (email, rules)" },
  { id: "Audit.SharePoint",           label: "SharePoint / OneDrive" },
  { id: "Audit.General",              label: "General Admin Activity" },
];

// Providers with a working connector. Coming-soon ones live in COMING_SOON below.
const PROVIDERS: { type: string; name: string; icon: React.ElementType; accent: string; description: string }[] = [
  { type: "O365",   name: "Microsoft 365",  icon: Cloud,  accent: "text-blue-600 dark:text-blue-400 bg-blue-500/10",     description: "Azure AD, Exchange, SharePoint audit logs" },
  { type: "SOPHOS", name: "Sophos Central", icon: Shield, accent: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10", description: "Threat detections, IPS, web filtering" },
  { type: "WAZUH",  name: "Wazuh",          icon: Radar,  accent: "text-teal-600 dark:text-teal-400 bg-teal-500/10",       description: "On-prem SIEM alerts and vulnerabilities (push)" },
];

/** Push integrations receive data from the source, so there is nothing to "sync". */
const PUSH_TYPES = new Set(["WAZUH"]);

function providerMeta(type: string) {
  return PROVIDERS.find((p) => p.type === type) ?? { type, name: type, icon: Cloud, accent: "text-muted-foreground bg-muted", description: "" };
}

// ── Status badge ──────────────────────────────────────────────────────────────

function SyncStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline" className="text-muted-foreground">Never synced</Badge>;
  if (status === "SUCCESS")
    return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Synced</Badge>;
  if (status === "RUNNING")
    return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
  if (status === "ERROR")
    return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

type ConfigDialogProps = {
  open: boolean;
  onClose: () => void;
  existing: Integration | null;
  onSaved: () => void;
};

// ── Microsoft 365 config dialog ───────────────────────────────────────────────

function O365ConfigDialog({ open, onClose, existing, onSaved }: ConfigDialogProps) {
  const [name,          setName]          = useState("");
  const [tenantId,      setTenantId]      = useState("");
  const [clientId,      setClientId]      = useState("");
  const [clientSecret,  setClientSecret]  = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["Audit.AzureActiveDirectory"]);
  const [saving,        setSaving]        = useState(false);
  const [testResult,    setTestResult]    = useState<string | null>(null);
  const [testing,       setTesting]       = useState(false);

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? "Microsoft 365");
      setTenantId(existing?.tenantId ?? "");
      setClientId(existing?.clientId ?? "");
      setClientSecret("");
      const cfg = (existing?.config as { contentTypes?: string[] } | null);
      setSelectedTypes(cfg?.contentTypes ?? ["Audit.AzureActiveDirectory"]);
      setTestResult(null);
    }
  }, [open, existing]);

  function toggleType(id: string) {
    setSelectedTypes(prev => (prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]));
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/integrations/test-o365", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, clientId, clientSecret }),
      });
      const data = await res.json();
      setTestResult(res.ok ? "✓ Connection successful" : `Error: ${data.error ?? "Unknown"}`);
    } catch {
      setTestResult("Error: Network failure");
    }
    setTesting(false);
  }

  async function handleSave() {
    if (!name.trim() || !tenantId.trim() || !clientId.trim()) return;
    setSaving(true);
    try {
      const payload = {
        type:    "O365",
        name:    name.trim(),
        tenantId: tenantId.trim(),
        clientId: clientId.trim(),
        ...(clientSecret ? { clientSecret } : {}),
        config: { contentTypes: selectedTypes },
      };
      const url    = existing ? `/api/integrations/${existing.id}` : "/api/integrations";
      const method = existing ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
      onClose();
    } catch {
      // ignore — user can retry
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit" : "Connect"} Microsoft 365</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Create an Azure AD App Registration with <code className="text-xs bg-muted px-1 rounded">ActivityFeed.Read</code> application permission, then enter the credentials below.
          </p>

          <div className="space-y-1">
            <Label>Integration Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Microsoft 365" />
          </div>
          <div className="space-y-1">
            <Label>Tenant ID (Directory ID)</Label>
            <Input value={tenantId} onChange={e => setTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label>Application (Client) ID</Label>
            <Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label>Client Secret {existing && <span className="text-muted-foreground text-xs">(leave blank to keep existing)</span>}</Label>
            <Input value={clientSecret} onChange={e => setClientSecret(e.target.value)} type="password" placeholder={existing ? "••••••••••••••••" : "Enter client secret"} />
          </div>

          <div className="space-y-2">
            <Label>Audit Log Sources</Label>
            <div className="space-y-2">
              {O365_CONTENT_TYPES.map(ct => (
                <label key={ct.id} className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent">
                  <input type="checkbox" checked={selectedTypes.includes(ct.id)} onChange={() => toggleType(ct.id)} className="h-4 w-4" />
                  <div>
                    <div className="text-sm font-medium">{ct.label}</div>
                    <div className="text-xs text-muted-foreground">{ct.id}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {testResult && (
            <p className={`text-sm ${testResult.startsWith("✓") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{testResult}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || !tenantId || !clientId || (!clientSecret && !existing)}>
            {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving || !name || !tenantId || !clientId}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {existing ? "Save Changes" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sophos Central config dialog ──────────────────────────────────────────────

const SOPHOS_SEVERITIES = [
  { id: "",       label: "All severities" },
  { id: "low",    label: "Low and above" },
  { id: "medium", label: "Medium and above" },
  { id: "high",   label: "High only" },
];

function SophosConfigDialog({ open, onClose, existing, onSaved }: ConfigDialogProps) {
  const [name,         setName]         = useState("");
  const [clientId,     setClientId]     = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [minSeverity,  setMinSeverity]  = useState("");
  const [saving,       setSaving]       = useState(false);
  const [testResult,   setTestResult]   = useState<string | null>(null);
  const [testing,      setTesting]      = useState(false);

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? "Sophos Central");
      setClientId(existing?.clientId ?? "");
      setClientSecret("");
      const cfg = (existing?.config as { minSeverity?: string } | null);
      setMinSeverity(cfg?.minSeverity ?? "");
      setTestResult(null);
    }
  }, [open, existing]);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/integrations/test-sophos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      const data = await res.json();
      setTestResult(res.ok ? "✓ Connection successful" : `Error: ${data.error ?? "Unknown"}`);
    } catch {
      setTestResult("Error: Network failure");
    }
    setTesting(false);
  }

  async function handleSave() {
    if (!name.trim() || !clientId.trim()) return;
    setSaving(true);
    try {
      const payload = {
        type:     "SOPHOS",
        name:     name.trim(),
        clientId: clientId.trim(),
        ...(clientSecret ? { clientSecret } : {}),
        config: { ...(minSeverity ? { minSeverity } : {}) },
      };
      const url    = existing ? `/api/integrations/${existing.id}` : "/api/integrations";
      const method = existing ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
      onClose();
    } catch {
      // ignore — user can retry
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit" : "Connect"} Sophos Central</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            In Sophos Central, go to <span className="font-medium">Global Settings → API Credentials Management</span>, create a tenant-level credential, and enter its Client ID and Client Secret below.
          </p>

          <div className="space-y-1">
            <Label>Integration Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Sophos Central" />
          </div>
          <div className="space-y-1">
            <Label>Client ID</Label>
            <Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label>Client Secret {existing && <span className="text-muted-foreground text-xs">(leave blank to keep existing)</span>}</Label>
            <Input value={clientSecret} onChange={e => setClientSecret(e.target.value)} type="password" placeholder={existing ? "••••••••••••••••" : "Enter client secret"} />
          </div>
          <div className="space-y-1">
            <Label>Minimum Severity</Label>
            <select
              value={minSeverity}
              onChange={e => setMinSeverity(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {SOPHOS_SEVERITIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Only ingest events at or above this severity.</p>
          </div>

          {testResult && (
            <p className={`text-sm ${testResult.startsWith("✓") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{testResult}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || !clientId || (!clientSecret && !existing)}>
            {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving || !name || !clientId}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {existing ? "Save Changes" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Wazuh config dialog (push model) ──────────────────────────────────────────

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/50 p-2 font-mono text-xs">{value}</pre>
    </div>
  );
}

function WazuhSetupSteps({ integrationId, token, minLevel, importVulnerabilities }: { integrationId: string; token: string | null; minLevel: number; importVulnerabilities: boolean }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const hookUrl = wazuhHookUrl(origin, integrationId);
  const shownToken = token ?? "<YOUR_TOKEN>";
  return (
    <div className="space-y-3">
      {token ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          Copy the token now. For security it is shown only once. If you lose it, use <span className="font-medium">Regenerate token</span>.
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">The token is not shown again. Use <span className="font-medium">Regenerate token</span> to get a new one (the old one stops working).</p>
      )}
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          Download the script{" "}
          <a className="font-medium text-primary underline" href="/api/integrations/wazuh/script">custom-masar</a>{" "}
          and copy it to the Wazuh manager.
        </li>
        <li>Install it and add the block{importVulnerabilities ? "s" : ""} below to <code>/var/ossec/etc/ossec.conf</code>.</li>
        <li>Restart the manager. New alerts appear in Security Events within seconds.</li>
      </ol>
      <CopyBlock label="Webhook URL" value={hookUrl} />
      {token && <CopyBlock label="Token" value={token} />}
      <CopyBlock label="ossec.conf — alerts" value={wazuhOssecConfBlock(hookUrl, shownToken, minLevel)} />
      {importVulnerabilities && <CopyBlock label="ossec.conf — vulnerabilities (recommended)" value={wazuhOssecConfVulnBlock(hookUrl, shownToken)} />}
      <CopyBlock label="Install commands" value={WAZUH_INSTALL_COMMANDS} />
      <p className="text-xs text-muted-foreground">The Wazuh manager only needs outbound HTTPS to this site. No inbound ports are opened.</p>
    </div>
  );
}

function WazuhConfigDialog({ open, onClose, existing, onSaved }: ConfigDialogProps) {
  const [name, setName] = useState("");
  const [minLevel, setMinLevel] = useState(7);
  const [importVulns, setImportVulns] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; token: string | null } | null>(null);

  useEffect(() => {
    if (open) {
      const cfg = existing?.config as { minLevel?: number; importVulnerabilities?: boolean } | null;
      setName(existing?.name ?? "Wazuh SIEM");
      setMinLevel(typeof cfg?.minLevel === "number" ? cfg.minLevel : 7);
      setImportVulns(cfg?.importVulnerabilities ?? true);
      setError(null);
      setCreated(existing ? { id: existing.id, token: null } : null);
    }
  }, [open, existing]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const config = { minLevel, importVulnerabilities: importVulns };
      if (existing) {
        const res = await fetch(`/api/integrations/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), config }),
        });
        if (!res.ok) throw new Error();
        onSaved();
        onClose();
      } else {
        const res = await fetch("/api/integrations/wazuh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), ...config }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        setCreated({ id: data.integration.id, token: data.token });
        onSaved();
      }
    } catch {
      setError("Could not save. Please try again.");
    }
    setSaving(false);
  }

  async function handleRegenerate() {
    if (!created) return;
    if (!confirm("Generate a new token? The current token stops working until you update ossec.conf.")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${created.id}/wazuh-token`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setCreated({ id: created.id, token: data.token });
    } catch {
      setError("Could not regenerate the token.");
    }
    setSaving(false);
  }

  const justCreated = !existing && created;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Configure" : justCreated ? "Set up" : "Connect"} Wazuh</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!justCreated && (
            <>
              <p className="text-sm text-muted-foreground">
                Your on-prem Wazuh manager pushes alerts to Masar. Masar never connects into your network.
              </p>
              <div className="space-y-1">
                <Label>Integration Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Wazuh SIEM" />
              </div>
              <div className="space-y-1">
                <Label>Minimum alert level</Label>
                <select
                  value={minLevel}
                  onChange={e => setMinLevel(Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {WAZUH_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Alerts below this Wazuh rule level are ignored. Keep it the same as &lt;level&gt; in ossec.conf.</p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={importVulns} onChange={e => setImportVulns(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                <span>
                  Import vulnerabilities into Vulnerability Management
                  <span className="block text-xs text-muted-foreground">Findings are closed automatically when Wazuh reports them solved.</span>
                </span>
              </label>
            </>
          )}

          {created && (
            <WazuhSetupSteps integrationId={created.id} token={created.token} minLevel={minLevel} importVulnerabilities={importVulns} />
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          {created && (
            <Button variant="outline" onClick={handleRegenerate} disabled={saving}>
              <KeyRound className="h-4 w-4 mr-2" />
              Regenerate token
            </Button>
          )}
          {justCreated ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {existing ? "Save Changes" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Coming-soon card ──────────────────────────────────────────────────────────

function ComingSoonCard({ icon: Icon, name, description }: { icon: React.ElementType; name: string; description: string }) {
  return (
    <Card className="opacity-60">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">{name}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
          <Badge variant="outline" className="ml-auto text-xs">Coming soon</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Integration coming in a future release.</p>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [dialog,       setDialog]       = useState<{ type: string; existing: Integration | null } | null>(null);
  const [syncing,      setSyncing]      = useState<Record<string, boolean>>({});
  const [deleting,     setDeleting]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) setIntegrations(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeIntegrations = integrations.filter(i => PROVIDERS.some(p => p.type === i.type));

  async function handleSync(id: string) {
    setSyncing(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/integrations/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) alert(`Sync failed: ${data.error}`);
      await load();
    } catch {
      alert("Network error during sync");
    }
    setSyncing(prev => ({ ...prev, [id]: false }));
  }

  async function handleToggle(integration: Integration) {
    try {
      await fetch(`/api/integrations/${integration.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !integration.enabled }),
      });
      await load();
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this integration? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch(`/api/integrations/${id}`, { method: "DELETE" });
      await load();
    } catch { /* ignore */ }
    setDeleting(null);
  }

  function fmtTime(iso: string | null) {
    if (!iso) return "Never";
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  }

  function logSourceCount(i: Integration): number {
    const cfg = i.config as { contentTypes?: string[] } | null;
    if (i.type === "O365") return cfg?.contentTypes?.length ?? 1;
    return 1;
  }

  function logSourceLabel(i: Integration): string {
    if (i.type === "WAZUH") {
      const cfg = i.config as { minLevel?: number } | null;
      return `Alerts level ${cfg?.minLevel ?? 7}+`;
    }
    return `${logSourceCount(i)} selected`;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Connect external services to stream security events into your SIEM.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map(p => (
            <Button key={p.type} variant="outline" onClick={() => setDialog({ type: p.type, existing: null })}>
              <Plug className="h-4 w-4 mr-2" />
              Connect {p.name}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Active integrations ── */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading integrations…
        </div>
      ) : activeIntegrations.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</h2>
          {activeIntegrations.map(integration => {
            const meta = providerMeta(integration.type);
            const Icon = meta.icon;
            return (
              <Card key={integration.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-md ${meta.accent}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        <CardDescription className="text-xs font-mono">{integration.tenantId ?? meta.name}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SyncStatusBadge status={integration.lastSyncStatus} />
                      <Button size="sm" variant={integration.enabled ? "default" : "outline"} onClick={() => handleToggle(integration)} className="text-xs h-7 px-2">
                        {integration.enabled ? "Enabled" : "Disabled"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Events ingested</p>
                      <p className="text-lg font-semibold">{integration.eventCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{PUSH_TYPES.has(integration.type) ? "Last alert" : "Last sync"}</p>
                      <p className="text-sm font-medium">{fmtTime(integration.lastSyncAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-sm font-medium">{integration.enabled ? "Enabled" : "Disabled"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Log sources</p>
                      <p className="text-sm font-medium">{logSourceLabel(integration)}</p>
                    </div>
                  </div>
                  {integration.lastSyncError && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-red-700 dark:text-red-400">{integration.lastSyncError}</p>
                    </div>
                  )}
                </CardContent>
                <div className="flex gap-2 border-t px-6 py-4">
                  {!PUSH_TYPES.has(integration.type) && (
                    <Button size="sm" onClick={() => handleSync(integration.id)} disabled={syncing[integration.id] || !integration.enabled}>
                      {syncing[integration.id]
                        ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Syncing…</>
                        : <><RefreshCw className="h-3 w-3 mr-1.5" />Sync Now</>}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setDialog({ type: integration.type, existing: integration })}>
                    <Settings className="h-3 w-3 mr-1.5" />
                    Configure
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto" onClick={() => handleDelete(integration.id)} disabled={deleting === integration.id}>
                    {deleting === integration.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <WifiOff className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">No integrations connected</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Connect Microsoft 365, Sophos Central or Wazuh to start streaming audit events into your Security Event Log.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {PROVIDERS.map(p => (
                <Button key={p.type} variant="outline" onClick={() => setDialog({ type: p.type, existing: null })}>
                  <Plug className="h-4 w-4 mr-2" />
                  Connect {p.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Coming-soon connectors ── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Coming Soon</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ComingSoonCard icon={Cloud} name="AWS CloudTrail" description="Ingest IAM, S3, EC2, and API Gateway audit events" />
          <ComingSoonCard icon={Wifi}  name="Google Workspace" description="Import Admin, Drive, Gmail, and Login audit logs" />
          <ComingSoonCard icon={Cloud} name="Azure Sentinel" description="Pull security incidents and analytics alerts" />
        </div>
      </div>

      {/* ── Cron setup instructions ── */}
      <Card className="border-dashed bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Automated Sync Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>All enabled integrations sync automatically once daily via Vercel Cron (Hobby plan limit; upgrade to Pro for more frequent syncs). Use “Sync Now” for on-demand. To trigger from an external scheduler:</p>
          <code className="block bg-card border rounded px-3 py-2 text-xs font-mono break-all">
            POST /api/cron/siem-sync  —  Header: x-cron-secret: YOUR_CRON_SECRET
          </code>
          <p className="text-xs">
            Set the <code className="bg-muted px-1 rounded">CRON_SECRET</code> environment variable in your deployment settings.
            The schedule is defined in <code className="bg-muted px-1 rounded">vercel.json</code>.
          </p>
        </CardContent>
      </Card>

      {/* ── Configure dialogs ── */}
      <O365ConfigDialog
        open={dialog?.type === "O365"}
        onClose={() => setDialog(null)}
        existing={dialog?.existing ?? null}
        onSaved={load}
      />
      <SophosConfigDialog
        open={dialog?.type === "SOPHOS"}
        onClose={() => setDialog(null)}
        existing={dialog?.existing ?? null}
        onSaved={load}
      />
      <WazuhConfigDialog
        open={dialog?.type === "WAZUH"}
        onClose={() => setDialog(null)}
        existing={dialog?.existing ?? null}
        onSaved={load}
      />
    </div>
  );
}
