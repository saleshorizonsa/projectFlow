"use client";

import { AlertTriangle, CheckCircle2, Clock3, MessageSquare, Paperclip } from "lucide-react";
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

export function GapWorkspace({ gaps, currentUserId, currentUserRole }: { gaps: Gap[]; currentUserId: string; currentUserRole: string }) {
  const router = useRouter();
  const open = gaps.filter((gap) => gap.status !== "CLOSED").length;
  const critical = gaps.filter((gap) => gap.severity === "CRITICAL" && gap.status !== "CLOSED").length;
  const overdue = gaps.filter((gap) => trafficLight(gap.targetClosureDate, gap.status) === "red").length;

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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Open Gaps" value={open} icon={Clock3} />
        <Metric title="Critical Gaps" value={critical} icon={AlertTriangle} />
        <Metric title="Overdue Gaps" value={overdue} icon={CheckCircle2} />
      </div>
      <Tabs defaultValue="register" className="space-y-4">
        <TabsList>
          <TabsTrigger value="register">Gap Register</TabsTrigger>
          <TabsTrigger value="actions">Action Plans</TabsTrigger>
        </TabsList>
        <TabsContent value="register" className="grid gap-4 xl:grid-cols-2">
          {gaps.map((gap) => (
            <GapCard
              key={gap.id}
              gap={gap}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onDelete={() => deleteGap(gap)}
            />
          ))}
        </TabsContent>
        <TabsContent value="actions" className="space-y-4">
          {gaps.flatMap((gap) => gap.actions.map((action) => (
            <Card key={action.id}>
              <CardHeader><CardTitle className="text-sm">{action.actionId} / {gap.title}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{action.correctiveAction}</p>
                    <p className="text-xs text-muted-foreground">
                      {action.responsiblePerson?.name ?? "Unassigned"} / due {new Date(action.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={action.status === "COMPLETED" ? "success" : "secondary"}>{formatEnum(action.status)}</Badge>
                    <GapActionEditDialog action={action} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteAction(action)} aria-label="Delete action plan"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <Progress value={action.progress} />
              </CardContent>
            </Card>
          )))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GapCard({ gap, currentUserId, currentUserRole, onDelete }: {
  gap: Gap;
  currentUserId: string;
  currentUserRole: string;
  onDelete: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const canDelete = ["ADMIN", "PROJECT_MANAGER"].includes(currentUserRole);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle>{gap.gapId}: {gap.title}</CardTitle>
          <div className="mt-1 text-sm text-muted-foreground">{gap.project.name} / {gap.layer.name}</div>
          {gap.project.companies && gap.project.companies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {gap.project.companies.map((company) => <Badge key={company.id} variant="outline">{company.code}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={gap.severity === "CRITICAL" ? "destructive" : "warning"}>{formatEnum(gap.severity)}</Badge>
          <GapEditDialog gap={gap} compact />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete} aria-label="Delete gap"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{gap.description}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Info label="Impact" value={gap.impact} />
          <Info label="Root Cause" value={gap.rootCause} />
          <Info label="Owner" value={gap.owner.name} />
          <Info label="Target Closure" value={new Date(gap.targetClosureDate).toLocaleDateString()} />
        </div>
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
            currentUserRole={currentUserRole}
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

function Metric({ title, value, icon: Icon }: { title: string; value: number; icon: React.ElementType }) {
  return (
    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">{title}</CardTitle><Icon className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-3xl font-semibold">{value}</div></CardContent></Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value}</div></div>;
}
