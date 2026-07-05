"use client";

import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatEnum, trafficLight } from "@/lib/utils";
import { Clock, Search, Trash2 } from "lucide-react";
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

export function TaskBoard({ tasks, currentUserId = "", currentUserRole = "VIEWER" }: { tasks: Task[]; currentUserId?: string; currentUserRole?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const filteredTasks = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return tasks;
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.assignee.name.toLowerCase().includes(q)
    );
  }, [tasks, search]);

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!response.ok) window.alert("Task delete failed.");
    router.refresh();
  }

  return (
    <Tabs defaultValue="kanban" className="space-y-4">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search title or assignee…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
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
                {filteredTasks.filter((task) => task.status === status).map((task) => (
                  <div key={task.id} className="rounded-md border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 truncate text-sm font-medium">{task.title}</div>
                      <div className="flex shrink-0 gap-1">
                        <TaskEditDialog task={task} compact currentUserId={currentUserId} currentUserRole={currentUserRole} />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTask(task)} aria-label="Delete task"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{task.project?.name ?? "General operations"}</div>
                    {task.project?.companies && task.project.companies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.project.companies.map((company) => <Badge key={company.id} variant="outline">{company.code}</Badge>)}
                      </div>
                    )}
                    <div className="mt-2">
                      <LogHoursButton taskId={task.id} actual={task.actualHours} estimated={task.estimatedHours} onLogged={router.refresh} />
                    </div>
                    <div className="mt-1 flex items-center justify-between">
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
        <Card><CardContent className="space-y-3 pt-5">{filteredTasks.map((task) => <TaskLine key={task.id} task={task} onDelete={deleteTask} currentUserId={currentUserId} currentUserRole={currentUserRole} />)}</CardContent></Card>
      </TabsContent>
      <TabsContent value="calendar">
        <Card><CardContent className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-3">{filteredTasks.map((task) => <TaskLine key={task.id} task={task} onDelete={deleteTask} currentUserId={currentUserId} currentUserRole={currentUserRole} />)}</CardContent></Card>
      </TabsContent>
      <TabsContent value="gantt">
        <Card><CardContent className="space-y-4 pt-5">{filteredTasks.map((task) => <TaskLine key={task.id} task={task} gantt onDelete={deleteTask} currentUserId={currentUserId} currentUserRole={currentUserRole} />)}</CardContent></Card>
      </TabsContent>
    </Tabs>
  );
}

function LogHoursButton({ taskId, actual, estimated, onLogged }: { taskId: string; actual: number; estimated: number; onLogged: () => void }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const add = parseFloat(hours);
    if (isNaN(add) || add <= 0) { setOpen(false); return; }
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualHours: actual + add }),
    });
    setHours("");
    setOpen(false);
    onLogged();
  }

  if (open) {
    return (
      <div className="flex items-center gap-1">
        <Input ref={inputRef} type="number" min="0.25" step="0.25" placeholder="hrs" value={hours}
          onChange={e => setHours(e.target.value)} className="h-6 w-16 text-xs"
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
          autoFocus />
        <Button size="sm" className="h-6 px-1.5 text-xs" onClick={submit}>+</Button>
        <button className="text-xs text-muted-foreground" onClick={() => setOpen(false)}>✕</button>
      </div>
    );
  }

  return (
    <button className="flex items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={() => setOpen(true)} title="Log hours">
      <Clock className="h-3 w-3" />
      <span>{actual}h / {estimated}h</span>
    </button>
  );
}

function TaskLine({ task, gantt = false, onDelete, currentUserId, currentUserRole }: { task: Task; gantt?: boolean; onDelete: (task: Task) => void; currentUserId?: string; currentUserRole?: string }) {
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
          <LogHoursButton taskId={task.id} actual={task.actualHours} estimated={task.estimatedHours} onLogged={router.refresh} />
          <Badge variant={light === "red" ? "destructive" : light === "yellow" ? "warning" : "success"}>{formatEnum(task.status)}</Badge>
          <TaskEditDialog task={task} compact currentUserId={currentUserId ?? ""} currentUserRole={currentUserRole ?? "VIEWER"} />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDelete(task)} aria-label="Delete task"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {gantt && <div className="mt-3 h-2 rounded-full bg-muted"><div className="h-2 w-2/3 rounded-full bg-primary" /></div>}
    </div>
  );
}
