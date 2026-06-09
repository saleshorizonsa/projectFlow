import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDot, ListChecks, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getProjectWorkflows, workflowStageSlugs, type WorkflowStageStatus } from "@/lib/project-workflow";
import { formatEnum } from "@/lib/utils";

const statusVariant: Record<WorkflowStageStatus, "success" | "warning" | "destructive" | "secondary"> = {
  COMPLETE: "success",
  IN_PROGRESS: "warning",
  AT_RISK: "destructive",
  NOT_STARTED: "secondary",
};

const statusIcon: Record<WorkflowStageStatus, typeof CheckCircle2> = {
  COMPLETE: CheckCircle2,
  IN_PROGRESS: CircleDot,
  AT_RISK: TriangleAlert,
  NOT_STARTED: ListChecks,
};

const processSteps = ["Target State", "Current State", "Gap Analysis", "Requirements", "Tasks", "Execution", "Results", "Feedback"];

export default async function WorkflowPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const companyId = await selectedCompanyId(searchParams);
  const workflows = await getProjectWorkflows(companyId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Project Execution Workflow</h1>
        <p className="text-sm text-muted-foreground">Target State to Feedback governance mapped from live project, gap, task, deadline, and result data.</p>
      </div>

      <Card>
        <CardContent className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {processSteps.map((step, index) => (
            <div key={step} className="rounded-md border bg-background p-3">
              <div className="text-xs font-semibold text-primary">{String(index + 1).padStart(2, "0")}</div>
              <div className="mt-1 text-sm font-medium">{step}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4">
        {workflows.map((workflow) => (
          <Card key={workflow.projectId} className="overflow-hidden">
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <CardTitle className="truncate">{workflow.projectName}</CardTitle>
                  <CardDescription>{workflow.projectCode} / {workflow.client} / {workflow.managerName}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={workflow.health === "red" ? "destructive" : workflow.health === "yellow" ? "warning" : "success"}>{workflow.health.toUpperCase()}</Badge>
                  <Badge variant="secondary">{formatEnum(workflow.status)}</Badge>
                  <Badge variant="outline">{workflow.overallProgress}% workflow</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <Progress value={workflow.overallProgress} />

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {workflow.stages.map((stage, index) => {
                  const Icon = statusIcon[stage.status];
                  return (
                    <Link
                      key={stage.key}
                      href={companyId ? `/workflow/${workflow.projectId}/${workflowStageSlugs[stage.key]}?company=${companyId}` : `/workflow/${workflow.projectId}/${workflowStageSlugs[stage.key]}`}
                      className="min-w-0 rounded-md border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-primary" />
                          <div className="truncate text-sm font-medium">{stage.label}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Badge variant={statusVariant[stage.status]}>{formatEnum(stage.status)}</Badge>
                        <span className="text-xs text-muted-foreground">{stage.progress}%</span>
                      </div>
                      <Progress className="mt-3" value={stage.progress} />
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">{stage.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {stage.evidence.map((item) => (
                          <span key={item} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{item}</span>
                        ))}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
        {workflows.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">No projects available for workflow tracking.</CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
