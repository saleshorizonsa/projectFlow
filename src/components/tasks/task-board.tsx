"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatEnum, trafficLight } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { TaskEditDialog, type EditableTask } from "@/components/tasks/task-edit-dialog";

type Task = EditableTask & {
  id: string;
  title: string;
  description: string;
  priority: EditableTask["priority"];
  status: EditableTask["status"];
  dueDate: string;
  estimatedHours: number;
  actualHours: number;
  taskType: "PROJECT" | "GENERAL";
  project: { name: string; companies?: { id: string; name: string; code: string }[] } | null;
  assignee: { name: string };
  layer: { name: string } | null;
  subLayer: { name: string } | null;
};

const statuses = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED"];

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!response.ok) window.alert("Task delete failed.");
    router.refresh();
  }

  return (
    <Tabs defaultValue="kanban" className="space-y-4">
      <TabsList>
        <TabsTrigger value="kanban">Kanban</TabsTrigger>
        <TabsTrigger value="list">List</TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
        <TabsTrigger value="gantt">Gantt</TabsTrigger>
      </TabsList>
      <TabsContent value="kanban">
        <div className="grid gap-4 lg:grid-cols-5">
          {statuses.map((status) => (
            <Card key={status}>
              <CardHeader><CardTitle className="text-sm">{formatEnum(status)}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {tasks.filter((task) => task.status === status).map((task) => (
                  <div key={task.id} className="rounded-md border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 truncate text-sm font-medium">{task.title}</div>
                      <div className="flex shrink-0 gap-1">
                        <TaskEditDialog task={task} compact />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTask(task)} aria-label="Delete task"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{task.project?.name ?? "General operations"}</div>
                    {task.project?.companies && task.project.companies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.project.companies.map((company) => <Badge key={company.id} variant="outline">{company.code}</Badge>)}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <Badge variant={task.priority === "CRITICAL" ? "destructive" : "outline"}>{formatEnum(task.priority)}</Badge>
                      <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="list">
        <Card><CardContent className="space-y-3 pt-5">{tasks.map((task) => <TaskLine key={task.id} task={task} onDelete={deleteTask} />)}</CardContent></Card>
      </TabsContent>
      <TabsContent value="calendar">
        <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-3">{tasks.map((task) => <TaskLine key={task.id} task={task} onDelete={deleteTask} />)}</CardContent></Card>
      </TabsContent>
      <TabsContent value="gantt">
        <Card><CardContent className="space-y-4 pt-5">{tasks.map((task) => <TaskLine key={task.id} task={task} gantt onDelete={deleteTask} />)}</CardContent></Card>
      </TabsContent>
    </Tabs>
  );
}

function TaskLine({ task, gantt = false, onDelete }: { task: Task; gantt?: boolean; onDelete: (task: Task) => void }) {
  const light = trafficLight(task.dueDate, task.status);
  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">{task.title}</div>
          <div className="text-xs text-muted-foreground">
            {task.taskType === "PROJECT" ? `${task.layer?.name ?? "Project"} / ${task.subLayer?.name ?? "Execution"}` : "General operations"} / due {new Date(task.dueDate).toLocaleDateString()}
          </div>
          {task.project?.companies && task.project.companies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.project.companies.map((company) => <Badge key={company.id} variant="outline">{company.code}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={light === "red" ? "destructive" : light === "yellow" ? "warning" : "success"}>{formatEnum(task.status)}</Badge>
          <TaskEditDialog task={task} compact />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDelete(task)} aria-label="Delete task"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {gantt && <div className="mt-3 h-2 rounded-full bg-muted"><div className="h-2 w-2/3 rounded-full bg-primary" /></div>}
    </div>
  );
}
