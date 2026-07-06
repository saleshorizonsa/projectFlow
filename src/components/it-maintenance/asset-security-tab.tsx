import { differenceInHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Bug, DatabaseBackup, Shield, Siren } from "lucide-react";

type Vuln = { id: string; title: string; severity: string; status: string };
type RiskItem = { id: string; riskId: string; title: string; riskScore: number; status: string };
type BackupJob = { id: string; name: string; lastStatus: string; lastRunAt: Date | null; rpoHours: number };
type IncidentLink = { incident: { id: string; incidentId: string; title: string; severity: string; status: string } };

export type AssetSecurityRow = {
  id: string;
  assetTag: string;
  name: string;
  vulnerabilities: Vuln[];
  risks: RiskItem[];
  backupJobs: BackupJob[];
  incidents: IncidentLink[];
};

const VULN_SEVERITY: Record<string, "destructive" | "warning" | "secondary" | "outline"> = {
  CRITICAL: "destructive", HIGH: "destructive", MEDIUM: "warning", LOW: "secondary", INFORMATIONAL: "outline",
};

const RISK_LEVEL = (score: number): { label: string; variant: "destructive" | "warning" | "secondary" } => {
  if (score >= 15) return { label: "Critical", variant: "destructive" };
  if (score >= 9)  return { label: "High",     variant: "destructive" };
  if (score >= 4)  return { label: "Medium",   variant: "warning" };
  return           { label: "Low",      variant: "secondary" };
};

const INC_SEVERITY: Record<string, "destructive" | "warning" | "secondary"> = {
  CRITICAL: "destructive", HIGH: "destructive", MEDIUM: "warning", LOW: "secondary",
};

function rpoHealth(job: BackupJob): "ok" | "breached" | "unknown" {
  if (!job.lastRunAt) return "unknown";
  return differenceInHours(new Date(), job.lastRunAt) > job.rpoHours ? "breached" : "ok";
}

export function AssetSecurityTab({ assets }: { assets: AssetSecurityRow[] }) {
  const withVulns    = assets.filter(a => a.vulnerabilities.some(v => v.status !== "CLOSED"));
  const withRisks    = assets.filter(a => a.risks.some(r => r.status !== "CLOSED" && r.status !== "ACCEPTED"));
  const withIncidents = assets.filter(a => a.incidents.some(i => i.incident.status !== "CLOSED"));
  const withBackupIssues = assets.filter(a => a.backupJobs.some(b => rpoHealth(b) === "breached" || b.lastStatus === "FAILED"));

  const critVulns  = assets.flatMap(a => a.vulnerabilities).filter(v => v.severity === "CRITICAL" && v.status !== "CLOSED").length;
  const openRisks  = assets.flatMap(a => a.risks).filter(r => r.status !== "CLOSED" && r.status !== "ACCEPTED").length;
  const openInc    = assets.flatMap(a => a.incidents).filter(i => i.incident.status !== "CLOSED").length;

  const hotAssets = assets.filter(a =>
    a.vulnerabilities.some(v => (v.severity === "CRITICAL" || v.severity === "HIGH") && v.status !== "CLOSED") ||
    a.risks.some(r => r.riskScore >= 9 && r.status !== "CLOSED") ||
    a.incidents.some(i => (i.incident.severity === "CRITICAL" || i.incident.severity === "HIGH") && i.incident.status !== "CLOSED")
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Critical Vulns", value: critVulns, Icon: Bug, color: "text-red-600" },
          { label: "Open Risks", value: openRisks, Icon: AlertTriangle, color: "text-orange-500" },
          { label: "Open Incidents", value: openInc, Icon: Siren, color: "text-rose-600" },
          { label: "Backup Issues", value: withBackupIssues.length, Icon: DatabaseBackup, color: "text-yellow-600" },
        ].map(({ label, value, Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className={`h-8 w-8 shrink-0 ${color}`} />
              <div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* High-risk assets */}
      {hotAssets.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="border-b bg-destructive/5 pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <Shield className="h-4 w-4" /> {hotAssets.length} asset{hotAssets.length !== 1 ? "s" : ""} with critical / high exposure
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Critical Vulns</TableHead>
                    <TableHead>High Risks</TableHead>
                    <TableHead>Open Incidents</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotAssets.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.assetTag}</div>
                        <div className="text-xs text-muted-foreground">{a.name}</div>
                      </TableCell>
                      <TableCell>
                        {a.vulnerabilities.filter(v => (v.severity === "CRITICAL" || v.severity === "HIGH") && v.status !== "CLOSED").length > 0
                          ? <Badge variant="destructive">{a.vulnerabilities.filter(v => (v.severity === "CRITICAL" || v.severity === "HIGH") && v.status !== "CLOSED").length}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {a.risks.filter(r => r.riskScore >= 9 && r.status !== "CLOSED").length > 0
                          ? <Badge variant="destructive">{a.risks.filter(r => r.riskScore >= 9 && r.status !== "CLOSED").length}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {a.incidents.filter(i => i.incident.status !== "CLOSED").length > 0
                          ? <Badge variant="warning">{a.incidents.filter(i => i.incident.status !== "CLOSED").length}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vulnerabilities by asset */}
      {withVulns.length > 0 && (
        <Card>
          <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-transparent pb-3 dark:from-orange-950/20">
            <CardTitle className="flex items-center gap-2 text-base"><Bug className="h-4 w-4 text-orange-500" />Vulnerabilities by Asset</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Asset</TableHead><TableHead>Vulnerability</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {withVulns.flatMap(a => a.vulnerabilities.filter(v => v.status !== "CLOSED").map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="text-xs font-medium">{a.assetTag}</TableCell>
                      <TableCell className="text-sm">{v.title}</TableCell>
                      <TableCell><Badge variant={VULN_SEVERITY[v.severity] ?? "secondary"}>{v.severity}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{v.status.replace(/_/g, " ")}</Badge></TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risks by asset */}
      {withRisks.length > 0 && (
        <Card>
          <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-transparent pb-3 dark:from-amber-950/20">
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" />Risks by Asset</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Asset</TableHead><TableHead>Risk</TableHead><TableHead>Score</TableHead><TableHead>Status</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {withRisks.flatMap(a => a.risks.filter(r => r.status !== "CLOSED" && r.status !== "ACCEPTED").map(r => {
                    const level = RISK_LEVEL(r.riskScore);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-medium">{a.assetTag}</TableCell>
                        <TableCell className="text-sm">{r.title}</TableCell>
                        <TableCell><Badge variant={level.variant}>{r.riskScore} — {level.label}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{r.status.replace(/_/g, " ")}</Badge></TableCell>
                      </TableRow>
                    );
                  }))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Open incidents by asset */}
      {withIncidents.length > 0 && (
        <Card>
          <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-transparent pb-3 dark:from-rose-950/20">
            <CardTitle className="flex items-center gap-2 text-base"><Siren className="h-4 w-4 text-rose-500" />Incidents by Asset</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Asset</TableHead><TableHead>Incident</TableHead><TableHead>Severity</TableHead><TableHead>Status</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {withIncidents.flatMap(a => a.incidents.filter(i => i.incident.status !== "CLOSED").map(i => (
                    <TableRow key={i.incident.id}>
                      <TableCell className="text-xs font-medium">{a.assetTag}</TableCell>
                      <TableCell className="text-sm">{i.incident.title}</TableCell>
                      <TableCell><Badge variant={INC_SEVERITY[i.incident.severity] ?? "secondary"}>{i.incident.severity}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{i.incident.status.replace(/_/g, " ")}</Badge></TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backup health */}
      {assets.some(a => a.backupJobs.length > 0) && (
        <Card>
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-transparent pb-3 dark:from-blue-950/20">
            <CardTitle className="flex items-center gap-2 text-base"><DatabaseBackup className="h-4 w-4 text-blue-500" />Backup Health by Asset</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Asset</TableHead><TableHead>Backup Job</TableHead><TableHead>Last Status</TableHead><TableHead>RPO Health</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {assets.filter(a => a.backupJobs.length > 0).flatMap(a => a.backupJobs.map(b => {
                    const health = rpoHealth(b);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-xs font-medium">{a.assetTag}</TableCell>
                        <TableCell className="text-sm">{b.name}</TableCell>
                        <TableCell>
                          <Badge variant={b.lastStatus === "SUCCESS" ? "success" : b.lastStatus === "FAILED" ? "destructive" : "secondary"}>
                            {b.lastStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {health === "ok" && <Badge variant="success">Within RPO</Badge>}
                          {health === "breached" && <Badge variant="destructive">RPO Breached</Badge>}
                          {health === "unknown" && <Badge variant="secondary">No Data</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  }))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {hotAssets.length === 0 && withVulns.length === 0 && withRisks.length === 0 && withIncidents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No open security issues linked to any asset.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
