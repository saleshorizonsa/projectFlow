import { format } from "date-fns";

export type CalendarEventType = "maintenance" | "license" | "asset" | "milestone" | "task" | "gap" | "resource";

export type CalendarEvent = {
  id: string;
  title: string;
  subtitle?: string;        // e.g. "Asset SRV-001" or "Project Alpha"
  type: CalendarEventType;
  date: string;             // YYYY-MM-DD primary date
  endDate?: string;         // YYYY-MM-DD for multi-day (resource allocations)
  timeLabel?: string;       // "14:30" for maintenance windows
  status: string;
  severity?: string;
  isOverdue: boolean;
  isComplete: boolean;
  href: string;             // deep link
  companyId?: string;
  assignedTo?: string;
};

export const EVENT_COLORS: Record<CalendarEventType, { bg: string; text: string; border: string; dot: string }> = {
  maintenance: { bg: "bg-blue-100 dark:bg-blue-950",    text: "text-blue-700 dark:text-blue-300",   border: "border-blue-300 dark:border-blue-700",   dot: "bg-blue-500" },
  license:     { bg: "bg-amber-100 dark:bg-amber-950",  text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700", dot: "bg-amber-500" },
  asset:       { bg: "bg-purple-100 dark:bg-purple-950",text: "text-purple-700 dark:text-purple-300",border: "border-purple-300 dark:border-purple-700",dot: "bg-purple-500" },
  milestone:   { bg: "bg-emerald-100 dark:bg-emerald-950",text: "text-emerald-700 dark:text-emerald-300",border: "border-emerald-300 dark:border-emerald-700",dot: "bg-emerald-500" },
  task:        { bg: "bg-slate-100 dark:bg-slate-800",  text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-600",  dot: "bg-slate-500" },
  gap:         { bg: "bg-red-100 dark:bg-red-950",      text: "text-red-700 dark:text-red-300",     border: "border-red-300 dark:border-red-700",     dot: "bg-red-500" },
  resource:    { bg: "bg-teal-100 dark:bg-teal-950",    text: "text-teal-700 dark:text-teal-300",   border: "border-teal-300 dark:border-teal-700",   dot: "bg-teal-500" },
};

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  maintenance: "Maintenance", license: "License Renewal", asset: "Asset Review",
  milestone: "Milestone", task: "Task", gap: "Gap Closure", resource: "Resource Booking",
};

export function dateTodayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}
