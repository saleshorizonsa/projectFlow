import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getProjectWorkflow, workflowStageKeyFromSlug, type WorkflowStageStatus } from "@/lib/project-workflow";
import { formatEnum } from "@/lib/utils";

type PageProps = { params: Promise<{ projectId: string; stage: string }> };

const statusVariant: Record<WorkflowStageStatus, "success" | "warning" | "destructive" | "secondary"> = {
  COMPLETE: "success",
  IN_PROGRESS: "warning",
  AT_RISK: "destructive",
  NOT_STARTED: "secondary",
};

const stageActions = {
  TARGET_STATE: [
    { label: "Open Project Detail", href: "project" },
    { label: "Open Reports", href: "/reports" },
  ],
  CURRENT_STATE: [
    { label: "Edit Current State", href: "project-current-state" },
    { label: "Create Gap From Current State", href: "/gaps/new" },
  ],
  GAP_ANALYSIS: [
    { label: "Open Gap Register", href: "/gaps" },
    { label: "Create Gap", href: "/gaps/new" },
    { label: "Create Action Plan", href: "/gaps/actions/new" },
  ],
  REQUIREMENTS: [
    { label: "Open Project Requirements", href: "project-requirements" },
    { label: "Create Requirement Task", href: "/tasks/new" },
    { label: "Create Requirement Gap", href: "/gaps/new" },
  ],
  TASKS: [
    { label: "Open Task Management", href: "/tasks" },
    { label: "Open Project Detail", href: "project" },
  ],
  EXECUTION: [
    { label: "Open Deadline Monitor", href: "/deadlines" },
    { label: "Open Escalations", href: "/escalations" },
    { label: "Open Tasks", href: "/tasks" },
  ],
  RESULTS: [
    { label: "Open Reports", href: "/reports" },
    { label: "Open Project Detail", href: "project" },
  ],
  FEEDBACK: [
    { label: "Open Project Detail", href: "project" },
    { label: "Open Reports", href: "/reports" },
  ],
} as const;

export default async function WorkflowStagePage({ params }: PageProps) {
  const { projectId, stage: stageSlug } = await params;
  const stageKey = workflowStageKeyFromSlug(stageSlug);
  if (!stageKey) notFound();

  const workflow = await getProjectWorkflow(projectId);
  if (!workflow) notFound();

  const stage = workflow.stages.find((item) => item.key === stageKey);
  if (!stage) notFound();

  const actions = stageActions[stageKey].map((action) => ({
    label: action.label,
    href: resolveActionHref(action.href, workflow.projectId),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="mb-2 px-0">
            <Link href="/workflow"><ArrowLeft className="h-4 w-4" /> Workflow</Link>
          </Button>
          <h1 className="truncate text-2xl font-semibold">{stage.label}</h1>
          <p className="text-sm text-muted-foreground">{workflow.projectCode} / {workflow.projectName} / {workflow.managerName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant[stage.status]}>{formatEnum(stage.status)}</Badge>
          <Badge variant={workflow.health === "red" ? "destructive" : workflow.health === "yellow" ? "warning" : "success"}>{workflow.health.toUpperCase()}</Badge>
          <Badge variant="outline">{stage.progress}% complete</Badge>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{stage.label} Detail</CardTitle>
            <CardDescription>{stage.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Progress value={stage.progress} />
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Project" value={workflow.projectName} />
              <Info label="Client" value={workflow.client} />
              <Info label="Owner" value={stage.owner} />
              <Info label="Project Status" value={formatEnum(workflow.status)} />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Evidence</div>
              <div className="flex flex-wrap gap-2">
                {stage.evidence.map((item) => (
                  <span key={item} className="rounded-md bg-muted px-2 py-1 text-sm text-muted-foreground">{item}</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stage Actions</CardTitle>
            <CardDescription>Open the module related to this workflow stage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {actions.map((action) => (
              <Button key={action.href + action.label} asChild className="w-full justify-between" variant="outline">
                <Link href={action.href}>
                  {action.label}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function resolveActionHref(href: string, projectId: string) {
  if (href === "project") return `/projects/${projectId}`;
  if (href === "project-current-state") return `/projects/${projectId}#current-state`;
  if (href === "project-requirements") return `/projects/${projectId}#requirements`;
  return href;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium leading-6">{value}</div></div>;
}
