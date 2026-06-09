import type { ProjectStatus } from "@prisma/client";
import { projectCompanyWhere } from "@/lib/company-filter";
import { getProjectHealthSummary, type HealthLevel } from "@/lib/deadline-engine";
import { getPrisma } from "@/lib/prisma";

export type WorkflowStageKey =
  | "TARGET_STATE"
  | "CURRENT_STATE"
  | "GAP_ANALYSIS"
  | "REQUIREMENTS"
  | "TASKS"
  | "EXECUTION"
  | "RESULTS"
  | "FEEDBACK";

export type WorkflowStageStatus = "NOT_STARTED" | "IN_PROGRESS" | "AT_RISK" | "COMPLETE";

export type WorkflowStage = {
  key: WorkflowStageKey;
  label: string;
  status: WorkflowStageStatus;
  progress: number;
  owner: string;
  summary: string;
  evidence: string[];
};

export type ProjectWorkflow = {
  projectId: string;
  projectCode: string;
  projectName: string;
  client: string;
  managerName: string;
  status: ProjectStatus;
  health: HealthLevel;
  overallProgress: number;
  stages: WorkflowStage[];
};

const stageLabels: Record<WorkflowStageKey, string> = {
  TARGET_STATE: "Target State",
  CURRENT_STATE: "Current State",
  GAP_ANALYSIS: "Gap Analysis",
  REQUIREMENTS: "Requirements",
  TASKS: "Tasks",
  EXECUTION: "Execution",
  RESULTS: "Results",
  FEEDBACK: "Feedback",
};

export const workflowStageSlugs: Record<WorkflowStageKey, string> = {
  TARGET_STATE: "target-state",
  CURRENT_STATE: "current-state",
  GAP_ANALYSIS: "gap-analysis",
  REQUIREMENTS: "requirements",
  TASKS: "tasks",
  EXECUTION: "execution",
  RESULTS: "results",
  FEEDBACK: "feedback",
};

export function workflowStageKeyFromSlug(slug: string): WorkflowStageKey | null {
  const match = (Object.entries(workflowStageSlugs) as [WorkflowStageKey, string][]).find(([, value]) => value === slug);
  return match?.[0] ?? null;
}

export async function getProjectWorkflow(projectId: string) {
  const workflows = await getProjectWorkflows();
  return workflows.find((workflow) => workflow.projectId === projectId) ?? null;
}

function statusFromProgress(progress: number, atRisk = false): WorkflowStageStatus {
  if (atRisk) return "AT_RISK";
  if (progress >= 100) return "COMPLETE";
  if (progress > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}

function percent(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

export async function getProjectWorkflows(companyId?: string): Promise<ProjectWorkflow[]> {
  const prisma = getPrisma();
  const [projects, health] = await Promise.all([
    prisma.project.findMany({
      where: projectCompanyWhere(companyId),
      include: {
        manager: true,
        currentState: true,
        layers: { include: { subLayers: { include: { tasks: true, gaps: true } } } },
        tasks: true,
        milestones: true,
        gaps: { include: { actions: true } },
        comments: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    getProjectHealthSummary(prisma, new Date(), companyId),
  ]);
  const healthByProject = new Map(health.map((item) => [item.projectId, item]));

  return projects.map((project) => {
    const projectHealth = healthByProject.get(project.id);
    const openGaps = project.gaps.filter((gap) => gap.status !== "CLOSED");
    const criticalGaps = openGaps.filter((gap) => gap.severity === "CRITICAL");
    const closedGaps = project.gaps.filter((gap) => gap.status === "CLOSED");
    const completedTasks = project.tasks.filter((task) => task.status === "COMPLETED");
    const blockedTasks = project.tasks.filter((task) => task.status === "BLOCKED");
    const completedMilestones = project.milestones.filter((milestone) => milestone.status === "COMPLETED");
    const planningLayer = project.layers.find((layer) => layer.type === "PLANNING");
    const implementationLayer = project.layers.find((layer) => layer.type === "IMPLEMENTATION");
    const requirementsSubLayer = planningLayer?.subLayers.find((subLayer) => subLayer.name === "Requirements");
    const requirementsItems = (requirementsSubLayer?.tasks.length ?? 0) + (requirementsSubLayer?.gaps.length ?? 0);
    const actionCount = project.gaps.reduce((sum, gap) => sum + gap.actions.length, 0);
    const completedActions = project.gaps.reduce((sum, gap) => sum + gap.actions.filter((action) => action.status === "COMPLETED").length, 0);

    const targetProgress = project.description && project.milestones.length > 0 ? 100 : project.description || project.milestones.length > 0 ? 60 : 0;
    const currentStateRiskText = `${project.currentState?.risks ?? ""} ${project.currentState?.painPoints ?? ""} ${project.currentState?.constraints ?? ""}`.toLowerCase();
    const currentStateHasRisk = Boolean(project.currentState && /(risk|delay|blocked|constraint|issue|gap|manual|shortage|missing|dependency)/.test(currentStateRiskText));
    const currentProgress = project.currentState ? Math.max(60, project.currentState.confidenceLevel * 20) : 0;
    const gapProgress = project.gaps.length === 0 ? 0 : Math.max(30, percent(closedGaps.length, project.gaps.length));
    const requirementsProgress = requirementsItems > 0 ? 100 : planningLayer ? Math.min(planningLayer.completion, 70) : 0;
    const taskProgress = project.tasks.length > 0 ? percent(completedTasks.length, project.tasks.length) : 0;
    const executionProgress = implementationLayer ? implementationLayer.completion : taskProgress;
    const resultsProgress = project.status === "COMPLETED" ? 100 : project.milestones.length > 0 ? percent(completedMilestones.length, project.milestones.length) : 0;
    const feedbackProgress = project.comments.length > 0 ? 100 : project.status === "COMPLETED" ? 60 : 0;

    const stages: WorkflowStage[] = [
      {
        key: "TARGET_STATE",
        label: stageLabels.TARGET_STATE,
        status: statusFromProgress(targetProgress),
        progress: targetProgress,
        owner: project.manager.name,
        summary: "Defines what successful delivery should look like.",
        evidence: [`Description ${project.description ? "available" : "missing"}`, `${project.milestones.length} milestone${project.milestones.length === 1 ? "" : "s"} defined`],
      },
      {
        key: "CURRENT_STATE",
        label: stageLabels.CURRENT_STATE,
        status: statusFromProgress(currentProgress, currentStateHasRisk || projectHealth?.health === "red"),
        progress: currentProgress,
        owner: project.currentState?.assessedById ? project.manager.name : project.manager.name,
        summary: "Shows live project status, layer completion, and health.",
        evidence: project.currentState
          ? [`Assessment captured`, `Confidence: ${project.currentState.confidenceLevel}/5`, `Health: ${(projectHealth?.health ?? "green").toUpperCase()}`]
          : ["Current state assessment missing", `Health: ${(projectHealth?.health ?? "green").toUpperCase()}`],
      },
      {
        key: "GAP_ANALYSIS",
        label: stageLabels.GAP_ANALYSIS,
        status: statusFromProgress(gapProgress, criticalGaps.length > 0),
        progress: gapProgress,
        owner: project.manager.name,
        summary: "Identifies delivery gaps, root causes, severity, and corrective actions.",
        evidence: [`${project.gaps.length} gap${project.gaps.length === 1 ? "" : "s"} logged`, `${criticalGaps.length} critical open gap${criticalGaps.length === 1 ? "" : "s"}`, `${actionCount} action plan${actionCount === 1 ? "" : "s"}`],
      },
      {
        key: "REQUIREMENTS",
        label: stageLabels.REQUIREMENTS,
        status: statusFromProgress(requirementsProgress),
        progress: requirementsProgress,
        owner: project.manager.name,
        summary: "Captures planning requirements before work breakdown and execution.",
        evidence: [`Planning completion: ${planningLayer?.completion ?? 0}%`, `${requirementsItems} linked requirement item${requirementsItems === 1 ? "" : "s"}`],
      },
      {
        key: "TASKS",
        label: stageLabels.TASKS,
        status: statusFromProgress(taskProgress, blockedTasks.length > 0),
        progress: taskProgress,
        owner: project.manager.name,
        summary: "Converts requirements and gaps into assigned accountable work.",
        evidence: [`${project.tasks.length} task${project.tasks.length === 1 ? "" : "s"}`, `${completedTasks.length} completed`, `${blockedTasks.length} blocked`],
      },
      {
        key: "EXECUTION",
        label: stageLabels.EXECUTION,
        status: statusFromProgress(executionProgress, projectHealth?.health === "red"),
        progress: executionProgress,
        owner: project.manager.name,
        summary: "Tracks implementation work, blockers, deadlines, and corrective action progress.",
        evidence: [`Implementation completion: ${implementationLayer?.completion ?? 0}%`, `${completedActions}/${actionCount} corrective actions complete`],
      },
      {
        key: "RESULTS",
        label: stageLabels.RESULTS,
        status: statusFromProgress(resultsProgress),
        progress: resultsProgress,
        owner: project.manager.name,
        summary: "Measures completed milestones, delivery output, and final project outcome.",
        evidence: [`${completedMilestones.length}/${project.milestones.length} milestones complete`, `Project status: ${project.status.replaceAll("_", " ")}`],
      },
      {
        key: "FEEDBACK",
        label: stageLabels.FEEDBACK,
        status: statusFromProgress(feedbackProgress),
        progress: feedbackProgress,
        owner: project.manager.name,
        summary: "Captures review comments, lessons learned, and closure feedback.",
        evidence: [`${project.comments.length} comment${project.comments.length === 1 ? "" : "s"} captured`, project.status === "COMPLETED" ? "Ready for closure feedback" : "Feedback grows during execution"],
      },
    ];

    const overallProgress = Math.round(stages.reduce((sum, stage) => sum + stage.progress, 0) / stages.length);

    return {
      projectId: project.id,
      projectCode: project.projectId,
      projectName: project.name,
      client: project.client,
      managerName: project.manager.name,
      status: project.status,
      health: projectHealth?.health ?? "green",
      overallProgress,
      stages,
    };
  });
}
