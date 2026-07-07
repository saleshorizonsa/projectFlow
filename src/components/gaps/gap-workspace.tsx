"use client";

import { AlertOctagon, AlertTriangle, Clock3, MessageSquare, Paperclip } from "lucide-react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AttachmentSection } from "@/components/attachments/attachment-section";
import { CommentSection } from "@/components/comments/comment-section";
import { GapEditDialog, type EditableGap } from "@/components/gaps/gap-edit-dialog";
import { GapActionEditDialog, type EditableGapAction } from "@/components/gaps/gap-action-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatEnum, trafficLight } from "@/lib/utils";

type Gap = EditableGap & {
  id: string;
  gapId: string;
  title: string;
  description: string;
  severity: EditableGap["severity"];
  impact: string;
  rootCause: string;
  targetClosureDate: string;
  status: EditableGap["status"];
  project: { name: string; companies?: { id: string; name: string; code: string }[] };
  owner: { name: string };
  layer: { name: string };
  subLayer: { name: string } | null;
  actions: EditableGapAction[];
};

const ACTION_STATUSES = ["ALL", "PLANNED", "IN_PROGRESS", "COMPLETED"] as const;
type ActionStatusFilter = (typeof ACTION_STATUSES)[number];

const CAN_EDIT_ROLES = ["ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER"];
const CAN_DELETE_ROLES = ["ADMIN", "PROJECT_MANAGER"];

export function GapWorkspace({ gaps, currentUserId, currentUserRole }: { gaps: Gap[]; currentUserId: string; currentUserRole: string }) {
  const router = useRouter();
  const [actionFilter, setActionFilter] = useState<ActionStatusFilter>("ALL");
  const open = gaps.filter((gap) => gap.status !== "CLOSED").length;
  const critical = gaps.filter((gap) => gap.severity === "CRITICAL" && gap.status !== "CLOSED").length;
  const overdue = gaps.filter((gap) => trafficLight(gap.targetClosureDate, gap.status) === "red").length;
  const canEdit = CAN_EDIT_ROLES.includes(currentUserRole);
  const canDelete = CAN_DELETE_ROLES.includes(currentUserRole);

  async function deleteGap(gap: Gap) {
    if (!window.confirm(`Delete gap "${gap.title}" and its actions?`)) return;
    const response = await fetch(`/api/gaps/${gap.id}`, { method: "DELETE" });
    if (!response.ok) window.alert("Gap delete failed.");
    router.refresh();
  }

  async function deleteAction(action: EditableGapAction) {
    if (!window.confirm(`Delete action plan "${action.actionId}"?`)) return;
    const response = await fetch(`/api/gap-actions/${action.id}`, { method: "DELETE" });
    if (!response.ok) window.alert("Action plan delete failed.");
    router.refresh();
  }

  const allActions = gaps.flatMap((gap) =>
    gap.actions.map((action) => ({ action, gapTitle: gap.title })),
  );
  const filteredActions = actionFilter === "ALL"
    ? allActions
    : allActions.filter(({ action }) => action.status === actionFilter);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Open Gaps" value={open} icon={Clock3} />
        <Metric title="Critical Gaps" value={critical} icon={AlertTriangle} />
        <Metric title="Overdue Gaps" value={overdue} icon={AlertOctagon} variant={overdue > 0 ? "destructive" : "success"} />
      </div>
      <Tabs defaultValue="register" className="space-y-4">
        <TabsList>
          <TabsTrigger value="register">Gap Register</TabsTrigger>
          <TabsTrigger value="actions">
            Action Plans
            {allActions.filter(({ action }) => action.status !== "COMPLETED").length > 0 && (
              <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {allActions.filter(({ action }) => action.status !== "COMPLETED").length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="grid gap-4 xl:grid-cols-2">
          {gaps.map((gap) => (
            <GapCard
              key={gap.id}
              gap={gap}
              currentUserId={currentUserId}
              canEdit={canEdit}
              canDelete={canDelete}
              onDelete={() => deleteGap(gap)}
            />
          ))}
          {gaps.length === 0 && (
            <div className="xl:col-span-2 py-12 text-center text-muted-foreground">No gaps recorded.</div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {ACTION_STATUSES.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={actionFilter === status ? "default" : "outline"}
                onClick={() => setActionFilter(status)}
              >
                {status === "ALL" ? "All" : formatEnum(status)}
                {status !== "ALL" && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({allActions.filter(({ action }) => action.status === status).length})
                  </span>
                )}
              </Button>
            ))}
          </div>
          {filteredActions.map(({ action, gapTitle }) => (
            <Card key={action.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{gapTitle}</div>
                    <CardTitle className="mt-0.5 text-sm">{action.actionId}</CardTitle>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={action.status === "COMPLETED" ? "success" : action.status === "IN_PROGRESS" ? "warning" : "secondary"}>
                      {formatEnum(action.status)}
                    </Badge>
                    {canEdit && <GapActionEditDialog action={action} />}
                    {canDelete && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteAction(action)} aria-label="Delete action plan">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm">{action.correctiveAction}</p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {action.responsiblePerson?.name ?? "Unassigned"} · due {new Date(action.dueDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={action.progress} className="h-2" />
                  <span className="w-10 shrink-0 text-right text-xs font-medium">{action.progress}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredActions.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No {actionFilter === "ALL" ? "" : formatEnum(actionFilter).toLowerCase() + " "}action plans.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GapCard({ gap, currentUserId, canEdit, canDelete, onDelete }: {
  gap: Gap;
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const light = trafficLight(gap.targetClosureDate, gap.status);
  const closureDateColor = gap.status === "CLOSED"
    ? "text-muted-foreground"
    : light === "red"
    ? "text-destructive font-semibold"
    : light === "yellow"
    ? "text-amber-600 dark:text-amber-400 font-medium"
    : "text-emerald-600 dark:text-emerald-400";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="text-base">{gap.gapId}: {gap.title}</CardTitle>
          <div className="mt-1 text-sm text-muted-foreground">
            {gap.project.name} / {gap.layer.name}{gap.subLayer ? ` / ${gap.subLayer.name}` : ""}
          </div>
          {gap.project.companies && gap.project.companies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {gap.project.companies.map((company) => <Badge key={company.id} variant="outline">{company.code}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Badge variant={gap.severity === "CRITICAL" ? "destructive" : gap.severity === "HIGH" ? "warning" : "secondary"}>
            {formatEnum(gap.severity)}
          </Badge>
          <Badge variant={gap.status === "CLOSED" ? "success" : gap.status === "IN_PROGRESS" ? "warning" : "secondary"}>
            {formatEnum(gap.status)}
          </Badge>
          {canEdit && <GapEditDialog gap={gap} compact />}
          {canDelete && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete} aria-label="Delete gap">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{gap.description}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Info label="Impact" value={gap.impact} />
          <Info label="Root Cause" value={gap.rootCause} />
          <Info label="Owner" value={gap.owner.name} />
          <div>
            <div className="text-xs text-muted-foreground">Target Closure</div>
            <div className={closureDateColor}>{new Date(gap.targetClosureDate).toLocaleDateString()}</div>
          </div>
        </div>
        {gap.actions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Actions ({gap.actions.filter((a) => a.status !== "COMPLETED").length} pending)</div>
              {gap.actions.slice(0, 3).map((action) => (
                <div key={action.id} className="flex items-center gap-3">
                  <Progress value={action.progress} className="h-1.5 flex-1" />
                  <span className="w-8 shrink-0 text-right text-xs">{action.progress}%</span>
                  <Badge variant={action.status === "COMPLETED" ? "success" : "secondary"} className="text-[10px]">
                    {formatEnum(action.status)}
                  </Badge>
                </div>
              ))}
              {gap.actions.length > 3 && (
                <div className="text-xs text-muted-foreground">+{gap.actions.length - 3} more actions</div>
              )}
            </div>
          </>
        )}
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setShowComments((v) => !v)}>
            <MessageSquare className="h-3.5 w-3.5" />
            {showComments ? "Hide comments" : "Show comments"}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setShowAttachments((v) => !v)}>
            <Paperclip className="h-3.5 w-3.5" />
            {showAttachments ? "Hide attachments" : "Show attachments"}
          </Button>
        </div>
        {showComments && (
          <CommentSection
            entityType="gap"
            entityId={gap.id}
            currentUserId={currentUserId}
            currentUserRole={canEdit ? "TEAM_MEMBER" : "VIEWER"}
          />
        )}
        {showAttachments && (
          <AttachmentSection
            entityType="gap"
            entityId={gap.id}
            canDelete={canDelete}
          />
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ title, value, icon: Icon, variant = "secondary" }: {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: "destructive" | "success" | "secondary";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold leading-none">{value}</div>
        <Badge variant={variant}>{variant === "destructive" ? "Risk" : variant === "success" ? "OK" : "Track"}</Badge>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
