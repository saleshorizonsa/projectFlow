"use client";

import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatEnum, trafficLight } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Clock, GitBranch, Search, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { TaskEditDialog, type EditableTask } from "@/components/tasks/task-edit-dialog";

type Task = EditableTask & {
  id: string;
  title: string;
  description: string;
  priority: EditableTask["priority"];
  status: EditableTask["status"];
  startDate: string | null;
  dueDate: string;
  estimatedHours: number;
  actualHours: number;
  taskType: "PROJECT" | "GENERAL";
  assigneeId: string;
  parentTaskId: string | null;
  subtaskCount: number;
  project: { name: string; companies?: { id: string; name: string; code: string }[] } | null;
  assignee: { id: string; name: string };
  layer: { name: string } | null;
  subLayer: { name: string } | null;
};

type User = { id: string; name: string };

const statuses = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED"] as const;

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "destructive",
  HIGH: "warning",
  MEDIUM: "secondary",
  LOW: "outline",
};

export function TaskBoard({
  tasks,
  users = [],
  currentUserId = "",
  currentUserRole = "VIEWER",
}: {
  tasks: Task[];
  users?: User[];
  currentUserId?: string;
  currentUserRole?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterAssignee, setFilterAssignee] = useState("ALL");
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const canManage = currentUserRole === "ADMIN" || currentUserRole === "PROJECT_MANAGER";

  const filteredTasks = useMemo(() => {
    const q = search.toLowerCase();
    return tasks.filter((t) => {
      if (myTasksOnly && t.assigneeId !== currentUserId) return false;
      if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
      if (filterPriority !== "ALL" && t.priority !== filterPriority) return false;
      if (filterAssignee !== "ALL" && t.assigneeId !== filterAssignee) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.assignee.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, search, filterStatus, filterPriority, filterAssignee, myTasksOnly, currentUserId]);

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!res.ok) window.alert("Task delete failed.");
    router.refresh();
  }

  const activeCount = filteredTasks.filter((t) => t.status !== "COMPLETED").length;
  const overdueCount = filteredTasks.filter(
    (t) => t.status !== "COMPLETED" && new Date(t.dueDate) < new Date()
  ).length;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search title or assignee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-52"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{formatEnum(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32"><SelectValue placeholder="All priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All priorities</SelectItem>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All assignees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All assignees</SelectItem>
            {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={myTasksOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setMyTasksOnly((v) => !v)}
        >
          <User className="h-3.5 w-3.5 mr-1" />
          My tasks
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span>{filteredTasks.length} tasks</span>
          {overdueCount > 0 && <Badge variant="destructive">{overdueCount} overdue</Badge>}
          {activeCount > 0 && <Badge variant="outline">{activeCount} active</Badge>}
        </div>
      </div>

      <Tabs defaultValue="kanban" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
        </TabsList>

        {/* ── KANBAN ── */}
        <TabsContent value="kanban">
          <div className="grid gap-4 lg:grid-cols-5">
            {statuses.map((status) => {
              const col = filteredTasks.filter((t) => t.status === status);
              return (
                <Card key={status} className="flex flex-col">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      <span>{formatEnum(status)}</span>
                      <Badge variant="outline" className="text-[10px]">{col.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2 px-3 pb-3">
                    {col.length === 0 && (
                      <p className="py-4 text-center text-xs text-muted-foreground">No tasks</p>
                    )}
                    {col.map((task) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        canManage={canManage}
                        onDelete={deleteTask}
                        currentUserId={currentUserId}
                        currentUserRole={currentUserRole}
                        onLogged={router.refresh}
                      />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── LIST ── */}
        <TabsContent value="list">
          <Card>
            <CardContent className="divide-y p-0">
              {filteredTasks.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No tasks match the current filters.</p>
              )}
              {filteredTasks.map((task) => (
                <TaskLine key={task.id} task={task} canManage={canManage} onDelete={deleteTask} currentUserId={currentUserId} currentUserRole={currentUserRole} onLogged={router.refresh} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CALENDAR ── */}
        <TabsContent value="calendar">
          <CalendarView tasks={filteredTasks} month={calMonth} onMonthChange={setCalMonth} currentUserId={currentUserId} currentUserRole={currentUserRole} onLogged={router.refresh} canManage={canManage} onDelete={deleteTask} />
        </TabsContent>

        {/* ── GANTT ── */}
        <TabsContent value="gantt">
          <GanttView tasks={filteredTasks} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────
// Log Hours inline button
// ─────────────────────────────────────────────
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
          onChange={(e) => setHours(e.target.value)} className="h-6 w-16 text-xs"
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
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

// ─────────────────────────────────────────────
// Kanban card
// ─────────────────────────────────────────────
function KanbanCard({ task, canManage, onDelete, currentUserId, currentUserRole, onLogged }: {
  task: Task; canManage: boolean; onDelete: (t: Task) => void;
  currentUserId: string; currentUserRole: string; onLogged: () => void;
}) {
  const isOverdue = task.status !== "COMPLETED" && new Date(task.dueDate) < new Date();
  return (
    <div className={`rounded-md border bg-background p-3 ${isOverdue ? "border-destructive/40" : ""}`}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 truncate text-sm font-medium">{task.title}</div>
        <div className="flex shrink-0 gap-0.5">
          <TaskEditDialog task={task} compact currentUserId={currentUserId} currentUserRole={currentUserRole} />
          {canManage && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(task)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{task.project?.name ?? "General operations"}</div>
      {task.project?.companies && task.project.companies.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {task.project.companies.map((c) => <Badge key={c.id} variant="outline" className="text-[9px]">{c.code}</Badge>)}
        </div>
      )}
      <div className="mt-2">
        <LogHoursButton taskId={task.id} actual={task.actualHours} estimated={task.estimatedHours} onLogged={onLogged} />
      </div>
      {task.subtaskCount > 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          <span>{task.subtaskCount} subtask{task.subtaskCount > 1 ? "s" : ""}</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <Badge variant={PRIORITY_COLORS[task.priority] as "destructive" | "warning" | "secondary" | "outline"}>{task.priority}</Badge>
        <div className="flex items-center gap-1">
          {isOverdue && <Badge variant="destructive" className="text-[9px] px-1">Overdue</Badge>}
          <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// List row
// ─────────────────────────────────────────────
function TaskLine({ task, canManage, onDelete, currentUserId, currentUserRole, onLogged }: {
  task: Task; canManage: boolean; onDelete: (t: Task) => void;
  currentUserId: string; currentUserRole: string; onLogged: () => void;
}) {
  const light = trafficLight(task.dueDate, task.status);
  const isOverdue = task.status !== "COMPLETED" && new Date(task.dueDate) < new Date();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{task.title}</span>
          {task.parentTaskId && <Badge variant="outline" className="text-[9px]">subtask</Badge>}
          {task.subtaskCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3" />{task.subtaskCount}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {task.taskType === "PROJECT"
            ? `${task.layer?.name ?? "Project"} / ${task.subLayer?.name ?? "Execution"}`
            : "General operations"} · due {new Date(task.dueDate).toLocaleDateString("en-GB")}
          {isOverdue && <span className="ml-1 text-destructive font-semibold">overdue</span>}
        </div>
        {task.project?.companies && task.project.companies.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {task.project.companies.map((c) => <Badge key={c.id} variant="outline" className="text-[10px]">{c.code}</Badge>)}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <LogHoursButton taskId={task.id} actual={task.actualHours} estimated={task.estimatedHours} onLogged={onLogged} />
        <Badge variant={light === "red" ? "destructive" : light === "yellow" ? "warning" : "success"}>{formatEnum(task.status)}</Badge>
        <TaskEditDialog task={task} compact currentUserId={currentUserId} currentUserRole={currentUserRole} />
        {canManage && (
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDelete(task)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Calendar view — real monthly grid
// ─────────────────────────────────────────────
function CalendarView({ tasks, month, onMonthChange, currentUserId, currentUserRole, onLogged, canManage, onDelete }: {
  tasks: Task[];
  month: Date;
  onMonthChange: (d: Date) => void;
  currentUserId: string;
  currentUserRole: string;
  onLogged: () => void;
  canManage: boolean;
  onDelete: (t: Task) => void;
}) {
  const year = month.getFullYear();
  const mon = month.getMonth();

  const firstDay = new Date(year, mon, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, mon + 1, 0).getDate();

  // Build calendar grid cells (leading + days + trailing)
  const leading = firstDay === 0 ? 6 : firstDay - 1; // adjust so Mon is first
  const cells: (number | null)[] = [
    ...Array(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Group tasks by day
  const byDay = new Map<number, Task[]>();
  for (const t of tasks) {
    const d = new Date(t.dueDate);
    if (d.getFullYear() === year && d.getMonth() === mon) {
      const day = d.getDate();
      const arr = byDay.get(day) ?? [];
      arr.push(t);
      byDay.set(day, arr);
    }
  }

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === mon && today.getDate() === day;

  const monthLabel = month.toLocaleString("en-GB", { month: "long", year: "numeric" });

  return (
    <Card>
      <CardContent className="p-4">
        {/* Navigation */}
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => onMonthChange(new Date(year, mon - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold">{monthLabel}</span>
          <Button variant="ghost" size="icon" onClick={() => onMonthChange(new Date(year, mon + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day headers */}
        <div className="mb-1 grid grid-cols-7 gap-px text-center text-xs font-medium text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-px bg-border">
          {cells.map((day, i) => {
            const dayTasks = day ? (byDay.get(day) ?? []) : [];
            return (
              <div
                key={i}
                className={`min-h-[80px] bg-background p-1 ${day && isToday(day) ? "ring-1 ring-primary" : ""}`}
              >
                {day && (
                  <>
                    <div className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs ${isToday(day) ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((t) => (
                        <div key={t.id} className="group relative">
                          <TaskEditDialog task={t} currentUserId={currentUserId} currentUserRole={currentUserRole} calendarMode />
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {tasks.filter((t) => {
            const d = new Date(t.dueDate);
            return d.getFullYear() === year && d.getMonth() === mon;
          }).length === 0 && (
            <span>No tasks due this month.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Gantt view — time-scaled bars
// ─────────────────────────────────────────────
function GanttView({ tasks }: { tasks: Task[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Determine visible date range
  const dates = tasks.flatMap((t) => [
    t.startDate ? new Date(t.startDate) : new Date(t.dueDate),
    new Date(t.dueDate),
  ]);
  const earliest = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : today;
  const latest = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date(today.getTime() + 14 * 86400000);

  // Pad by 2 days on each side
  const rangeStart = new Date(earliest.getTime() - 2 * 86400000);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(latest.getTime() + 2 * 86400000);
  rangeEnd.setHours(0, 0, 0, 0);
  const totalDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000));

  function dayOffset(d: Date) {
    return Math.max(0, Math.round((d.getTime() - rangeStart.getTime()) / 86400000));
  }

  // Build week headers
  const weekHeaders: { label: string; colStart: number; span: number }[] = [];
  let cursor = new Date(rangeStart);
  while (cursor < rangeEnd) {
    const weekLabel = cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    const span = Math.min(7, Math.round((rangeEnd.getTime() - cursor.getTime()) / 86400000));
    weekHeaders.push({ label: weekLabel, colStart: dayOffset(cursor), span });
    cursor = new Date(cursor.getTime() + 7 * 86400000);
  }

  const todayOffset = dayOffset(today);

  const PRIORITY_BG: Record<string, string> = {
    CRITICAL: "bg-red-500",
    HIGH: "bg-orange-400",
    MEDIUM: "bg-blue-400",
    LOW: "bg-slate-400",
  };
  const STATUS_OPACITY: Record<string, string> = {
    COMPLETED: "opacity-40",
    BLOCKED: "opacity-70",
  };

  if (tasks.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
        No tasks to display. Adjust filters or create a task with a start date.
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-4">
        <div style={{ minWidth: `${Math.max(600, totalDays * 28)}px` }}>
          {/* Week header row */}
          <div className="relative mb-1 flex">
            <div className="w-48 shrink-0" />
            <div className="relative flex-1">
              <div className="flex">
                {weekHeaders.map((wh, i) => (
                  <div
                    key={i}
                    className="border-l border-border px-1 text-[10px] text-muted-foreground"
                    style={{ width: `${(wh.span / totalDays) * 100}%` }}
                  >
                    {wh.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks */}
          {tasks.map((task) => {
            const start = task.startDate ? new Date(task.startDate) : new Date(task.dueDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(task.dueDate);
            end.setHours(0, 0, 0, 0);
            const barStart = dayOffset(start);
            const barLen = Math.max(1, dayOffset(end) - barStart);
            const leftPct = (barStart / totalDays) * 100;
            const widthPct = (barLen / totalDays) * 100;
            const pct = task.estimatedHours > 0 ? Math.min(100, Math.round((task.actualHours / task.estimatedHours) * 100)) : 0;

            return (
              <div key={task.id} className="mb-1 flex items-center gap-2">
                <div className="w-48 shrink-0 truncate text-xs" title={task.title}>
                  <span className="font-medium">{task.title}</span>
                  <span className="ml-1 text-muted-foreground">{task.assignee.name}</span>
                </div>
                <div className="relative flex-1 h-7">
                  {/* Today marker */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary/50 z-10"
                    style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                  />
                  {/* Task bar background */}
                  <div
                    className={`absolute top-1 h-5 rounded-sm ${PRIORITY_BG[task.priority] ?? "bg-blue-400"} ${STATUS_OPACITY[task.status] ?? ""} opacity-20`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  />
                  {/* Progress fill */}
                  <div
                    className={`absolute top-1 h-5 rounded-sm ${PRIORITY_BG[task.priority] ?? "bg-blue-400"} ${STATUS_OPACITY[task.status] ?? ""}`}
                    style={{ left: `${leftPct}%`, width: `${(widthPct * pct) / 100}%` }}
                  />
                  {/* Label inside bar */}
                  {widthPct > 8 && (
                    <div
                      className="absolute top-1 h-5 flex items-center px-1 text-[9px] font-medium text-white pointer-events-none select-none"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    >
                      <span className="truncate">{pct}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
