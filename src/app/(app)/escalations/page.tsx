import { AlertTriangle, BellRing, ShieldAlert, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getEscalationMatrix, syncEscalationNotifications, type EscalationLevel } from "@/lib/escalation-matrix";
import { getPrisma } from "@/lib/prisma";

const levelVariant: Record<EscalationLevel, "destructive" | "warning" | "secondary"> = {
  LEVEL_3: "destructive",
  LEVEL_2: "warning",
  LEVEL_1: "secondary",
};

export default async function EscalationsPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const prisma = getPrisma();
  const companyId = await selectedCompanyId(searchParams);
  await syncEscalationNotifications(prisma);
  const matrix = await getEscalationMatrix(prisma, new Date(), companyId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Escalation Matrix</h1>
        <p className="text-sm text-muted-foreground">Automatic governance rules for overdue gaps, blocked tasks, missed milestones, and delayed projects.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Active Escalations" value={matrix.items.length} icon={BellRing} variant={matrix.items.length ? "destructive" : "secondary"} />
        <Metric title="Level 3" value={matrix.level3.length} icon={ShieldAlert} variant={matrix.level3.length ? "destructive" : "secondary"} />
        <Metric title="Level 2" value={matrix.level2.length} icon={AlertTriangle} variant={matrix.level2.length ? "warning" : "secondary"} />
        <Metric title="Rules Enabled" value={matrix.rules.length} icon={TimerReset} variant="secondary" />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Current Escalations</CardTitle>
            <CardDescription>These items crossed the escalation thresholds and generated in-app alerts for accountable users.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.items.map((item) => (
                  <TableRow key={`${item.module}-${item.id}-${item.ruleId}`}>
                    <TableCell>
                      <div className="min-w-48">
                        <div className="font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.module}</div>
                      </div>
                    </TableCell>
                    <TableCell>{item.projectName}</TableCell>
                    <TableCell>{item.ownerName}</TableCell>
                    <TableCell>{item.managerName}</TableCell>
                    <TableCell><Badge variant={levelVariant[item.level]}>{item.level.replace("_", " ")}</Badge></TableCell>
                    <TableCell>
                      <div className="min-w-52 text-sm text-muted-foreground">{item.reason}</div>
                    </TableCell>
                  </TableRow>
                ))}
                {matrix.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No active escalations.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
            <CardDescription>Thresholds used to trigger automatic escalation alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {matrix.rules.map((rule) => (
              <div key={rule.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{rule.trigger}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{rule.threshold}</div>
                  </div>
                  <Badge className="shrink-0" variant={levelVariant[rule.level]}>{rule.level.replace("_", " ")}</Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">Notify: {rule.notify}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Metric({ title, value, icon: Icon, variant }: { title: string; value: number; icon: typeof BellRing; variant: "destructive" | "warning" | "secondary" }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="truncate text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold leading-none">{value}</div>
        <Badge variant={variant}>{variant === "destructive" ? "Critical" : variant === "warning" ? "Risk" : "Ready"}</Badge>
      </CardContent>
    </Card>
  );
}
