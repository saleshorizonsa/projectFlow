"use client";
import { useState } from "react";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { YearView } from "@/components/calendar/year-view";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import { EventDialog } from "@/components/calendar/event-dialog";
import { FilterSidebar } from "@/components/calendar/filter-sidebar";
import { QuickCreateDialog } from "@/components/calendar/quick-create-dialog";
import type { CalendarEvent, CalendarEventType } from "@/lib/calendar-events";

type View = "year" | "month" | "week" | "day";

export type Filters = {
  types: CalendarEventType[];   // empty = all
  companyId: string;
  showCompleted: boolean;
};

export function CalendarShell({ events, year, companies, projects, currentUserId, currentUserRole }: {
  events: CalendarEvent[];
  year: number;
  companies: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(() => startOfMonth(new Date(year, new Date().getMonth(), 1)));
  const [filters, setFilters] = useState<Filters>({ types: [], companyId: "", showCompleted: true });
  const [openEvent, setOpenEvent] = useState<CalendarEvent | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filtering
  const filtered = events.filter((e) => {
    if (filters.types.length > 0 && !filters.types.includes(e.type)) return false;
    if (filters.companyId && e.companyId !== filters.companyId) return false;
    if (!filters.showCompleted && e.isComplete) return false;
    return true;
  });

  // Navigation
  function prev() {
    if (view === "month" || view === "year") setDate(subMonths(date, 1));
    else if (view === "week") setDate(subWeeks(date, 1));
    else setDate(subDays(date, 1));
  }
  function next() {
    if (view === "month" || view === "year") setDate(addMonths(date, 1));
    else if (view === "week") setDate(addWeeks(date, 1));
    else setDate(addDays(date, 1));
  }
  function goToday() { setDate(new Date()); }

  // Title
  let title = "";
  if (view === "year") title = format(date, "yyyy");
  else if (view === "month") title = format(date, "MMMM yyyy");
  else if (view === "week") title = `${format(startOfWeek(date, { weekStartsOn: 1 }), "d MMM")} – ${format(endOfWeek(date, { weekStartsOn: 1 }), "d MMM yyyy")}`;
  else title = format(date, "EEEE, d MMMM yyyy");

  const canEdit = ["ADMIN", "PROJECT_MANAGER"].includes(currentUserRole);
  const overdueCount = filtered.filter((e) => e.isOverdue).length;

  return (
    <div className="flex h-[calc(100vh-4.5rem)] flex-col gap-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prev} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
          <button onClick={goToday} className="min-w-[180px] text-center text-sm font-semibold hover:text-primary">{title}</button>
          <Button variant="ghost" size="icon" onClick={next} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          {overdueCount > 0 && <Badge variant="destructive">{overdueCount} overdue</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            {(["year","month","week","day"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters((f) => !f)}>
            <Filter className="h-3.5 w-3.5" /> Filters
            {filters.types.length > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{filters.types.length}</span>}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Filter sidebar */}
        {showFilters && (
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            companies={companies}
            onClose={() => setShowFilters(false)}
          />
        )}

        {/* Calendar view */}
        <div className="min-w-0 flex-1 overflow-auto">
          {view === "year"  && <YearView  events={filtered} date={date} onDayClick={(d) => { setDate(new Date(d)); setView("month"); }} onEventClick={setOpenEvent} />}
          {view === "month" && <MonthView events={filtered} date={date} onDayClick={(d) => { setDate(new Date(d)); if (canEdit) setCreateDate(d); }} onEventClick={setOpenEvent} onDayDoubleClick={(d) => { setDate(new Date(d)); setView("day"); }} />}
          {view === "week"  && <WeekView  events={filtered} date={date} onDayClick={(d) => { setDate(new Date(d)); setView("day"); }} onEventClick={setOpenEvent} />}
          {view === "day"   && <DayView   events={filtered} date={date} onEventClick={setOpenEvent} onCreateClick={canEdit ? (d) => setCreateDate(d) : undefined} />}
        </div>
      </div>

      {/* Dialogs */}
      <EventDialog event={openEvent} onClose={() => setOpenEvent(null)} />
      {createDate && (
        <QuickCreateDialog
          date={createDate}
          projects={projects}
          onClose={() => setCreateDate(null)}
        />
      )}
    </div>
  );
}
