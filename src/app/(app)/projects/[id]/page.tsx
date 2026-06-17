import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ClipboardList, Flag, TriangleAlert } from "lucide-react";
import { AttachmentSection } from "@/components/attachments/attachment-section";
import { CommentSection } from "@/components/comments/comment-section";
import { MilestonePanel, type MilestoneRow } from "@/components/milestones/milestone-panel";
import { ProjectCurrentStateForm } from "@/components/projects/project-current-state-form";
import { ProjectEditDialog } from "@/components/projects/project-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { formatEnum, trafficLight } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const project = await getPrisma().project.findUnique({
    where: { id },
    include: {
      manager: true,
      companies: { include: { company: true }, orderBy: { company: { name: "asc" } } },
      currentState: { include: { assessedBy: true } },
      layers: { include: { subLayers: true }, orderBy: { createdAt: "asc" } },
      milestones: { orderBy: { dueDate: "asc" } },
      tasks: { include: { assignee: true, layer: true, subLayer: true }, orderBy: { dueDate: "asc" } },
      gaps: { include: { owner: true, layer: true }, orderBy: [{ severity: "desc" }, { targetClosureDate: "asc" }] },
    },
  });

  if (!project) notFound();
  const [users, companies, comments] = await Promise.all([
    getPrisma().user.findMany({ orderBy: { name: "asc" } }),
    getPrisma().company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getPrisma().comment.findMany({
      where: { projectId: id },
      include: { author: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const averageCompletion = Math.round(project.layers.reduce((sum, layer) => sum + layer.completion, 0) / Math.max(project.layers.length, 1));
  const editableProject = {
    id: project.id,
    projectId: project.projectId,
    name: project.name,
    description: project.description,
    client: project.client,
    companies: project.companies.map((link) => ({ id: link.company.id, name: link.company.name, code: link.company.code })),
    startDate: project.startDate.toISOString(),
    endDate: project.endDate.toISOString(),
    status: project.status,
    priority: project.priority,
    budget: Number(project.budget),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="mb-2 px-0">
            <Link href="/projects"><ArrowLeft className="h-4 w-4" /> Projects & Current State</Link>
          </Button>
          <h1 className="truncate text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.manager.name}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {editableProject.companies.length > 0
              ? editableProject.companies.map((company) => <Badge key={company.id} variant="outline">{company.name}</Badge>)
              : <Badge variant="outline">{project.client}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{formatEnum(project.status)}</Badge>
          <Badge variant={project.priority === "CRITICAL" ? "destructive" : "outline"}>{formatEnum(project.priority)}</Badge>
          <ProjectEditDialog project={editableProject} companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))} />
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Overall Progress" value={`${averageCompletion}%`} icon={Flag} />
        <Metric title="Tasks" value={project.tasks.length.toString()} icon={ClipboardList} />
        <Metric title="Open Gaps" value={project.gaps.filter((gap) => gap.status !== "CLOSED").length.toString()} icon={TriangleAlert} />
        <Metric title="Milestones" value={`${project.milestones.filter((m) => m.status === "COMPLETED").length}/${project.milestones.length}`} icon={CalendarClock} />
      </section>

      <Card id="requirements" className="scroll-mt-20">
        <CardHeader><CardTitle>Layer Readiness</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {project.layers.map((layer) => (
            <div key={layer.id} className="rounded-md border p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="font-medium">{layer.name}</div>
                <Badge variant="outline">{layer.completion}%</Badge>
              </div>
              <Progress value={layer.completion} />
              <div className="mt-3 flex flex-wrap gap-2">
                {layer.subLayers.map((subLayer) => <Badge key={subLayer.id} variant="secondary">{subLayer.name}</Badge>)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section id="current-state" className="grid gap-4 xl:grid-cols-3 scroll-mt-20">
        {session?.user.role !== "VIEWER" ? (
          <>
            <div className="xl:col-span-2">
            <ProjectCurrentStateForm
              projectId={project.id}
              currentState={project.currentState ? {
                summary: project.currentState.summary,
                currentProcess: project.currentState.currentProcess,
                tools: project.currentState.tools,
                resources: project.currentState.resources,
                painPoints: project.currentState.painPoints,
                risks: project.currentState.risks,
                constraints: project.currentState.constraints,
                assessmentDate: project.currentState.assessmentDate.toISOString(),
                assessedById: project.currentState.assessedById,
                confidenceLevel: project.currentState.confidenceLevel,
              } : null}
              users={users.map((user) => ({ id: user.id, name: user.name }))}
              defaultAssessorId={session?.user.id ?? project.managerId}
            />
            </div>
            <CurrentStateSummary currentState={project.currentState} />
          </>
        ) : (
          <div className="xl:col-span-3"><CurrentStateSummary currentState={project.currentState} /></div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Discussion</CardTitle></CardHeader>
        <CardContent>
          <CommentSection
            entityType="project"
            entityId={project.id}
            currentUserId={session?.user.id ?? ""}
            currentUserRole={session?.user.role ?? "VIEWER"}
            initialComments={comments
              .filter((c) => c.author != null)
              .map((c) => ({
                id: c.id,
                body: c.body,
                createdAt: c.createdAt.toISOString(),
                author: { id: c.author.id, name: c.author.name, image: c.author.image ?? null },
              }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
        <CardContent>
          <AttachmentSection
            entityType="project"
            entityId={project.id}
            canDelete={["ADMIN", "PROJECT_MANAGER"].includes(session?.user.role ?? "")}
          />
        </CardContent>
      </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <MilestonePanel
            projectId={project.id}
            milestones={project.milestones.map((m): MilestoneRow => ({
              id: m.id,
              name: m.name,
              description: m.description,
              dueDate: m.dueDate.toISOString(),
              completion: m.completion,
              status: m.status as MilestoneRow["status"],
            }))}
            canEdit={["ADMIN", "PROJECT_MANAGER"].includes(session?.user.role ?? "")}
          />
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Task</TableHead><TableHead>Assignee</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {project.tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>{task.assignee.name}</TableCell>
                    <TableCell><Badge variant="secondary">{formatEnum(task.status)}</Badge></TableCell>
                    <TableCell>{task.dueDate.toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Gaps</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {project.gaps.map((gap) => {
              const light = trafficLight(gap.targetClosureDate, gap.status);
              return (
                <div key={gap.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{gap.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{gap.owner.name} / {gap.layer.name}</div>
                    </div>
                    <Badge className="shrink-0" variant={light === "red" ? "destructive" : light === "yellow" ? "warning" : "success"}>{formatEnum(gap.severity)}</Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function CurrentStateSummary({ currentState }: { currentState: {
  summary: string;
  currentProcess: string;
  tools: string;
  resources: string;
  painPoints: string;
  risks: string;
  constraints: string;
  assessmentDate: Date;
  confidenceLevel: number;
  assessedBy?: { name: string };
} | null }) {
  return (
    <Card>
      <CardHeader><CardTitle>Current State Snapshot</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {currentState ? (
          <>
            <p className="leading-6">{currentState.summary}</p>
            <Info label="Current Process" value={currentState.currentProcess} />
            <Info label="Pain Points" value={currentState.painPoints} />
            <Info label="Risks" value={currentState.risks} />
            <Info label="Constraints" value={currentState.constraints} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Tools / Systems" value={currentState.tools} />
              <Info label="Resources" value={currentState.resources} />
              <Info label="Assessed By" value={currentState.assessedBy?.name ?? "Not assigned"} />
              <Info label="Assessment Date" value={currentState.assessmentDate.toLocaleDateString()} />
              <Info label="Confidence" value={`${currentState.confidenceLevel} / 5`} />
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">No current state assessment has been captured for this project yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: string; icon: React.ElementType }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="truncate text-sm text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 shrink-0 text-primary" />
      </CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium leading-6">{value}</div></div>;
}
