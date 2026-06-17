"use client";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENT_COLORS, EVENT_TYPE_LABELS } from "@/lib/calendar-events";
import type { CalendarEvent } from "@/lib/calendar-events";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

export function DayView({ events, date, onEventClick, onCreateClick }: {
  events: CalendarEvent[];
  date: Date;
  onEventClick: (e: CalendarEvent) => void;
  onCreateClick?: (dateStr: string) => void;
}) {
  const dateStr   = format(date, "yyyy-MM-dd");
  const dayEvents = events.filter((e) => e.date === dateStr || (e.endDate && e.date <= dateStr && e.endDate >= dateStr));
  const timedEvents    = dayEvents.filter((e) => e.timeLabel);
  const allDayEvents   = dayEvents.filter((e) => !e.timeLabel);

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* Day header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3">
        <div>
          <div className="text-lg font-semibold">{format(date, "EEEE, d MMMM yyyy")}</div>
          <div className="text-xs text-muted-foreground">{dayEvents.length} event(s)</div>
        </div>
        {onCreateClick && (
          <button
            onClick={() => onCreateClick(dateStr)}
            className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Add event
          </button>
        )}
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b px-4 py-2 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">All-day</div>
          {allDayEvents.map((ev) => (
            <button
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className={cn("flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left hover:opacity-80", EVENT_COLORS[ev.type].bg, EVENT_COLORS[ev.type].border, EVENT_COLORS[ev.type].text)}
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold">{ev.title}</div>
                {ev.subtitle && <div className="text-[10px] opacity-80">{ev.subtitle}</div>}
              </div>
              <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium bg-black/10">{EVENT_TYPE_LABELS[ev.type]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1">
        {HOURS.map((h) => {
          const hourEvents = timedEvents.filter((e) => e.timeLabel && parseInt(e.timeLabel.split(":")[0], 10) === h);
          return (
            <div key={h} className="flex gap-0 border-b min-h-[56px]">
              <div className="w-14 shrink-0 border-r px-1 pt-1 text-[10px] text-muted-foreground">{String(h).padStart(2, "0")}:00</div>
              <div className="flex-1 space-y-1 px-2 py-1">
                {hourEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className={cn("flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left hover:opacity-80", EVENT_COLORS[ev.type].bg, EVENT_COLORS[ev.type].border, EVENT_COLORS[ev.type].text)}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">{ev.timeLabel} &mdash; {ev.title}</div>
                      {ev.subtitle && <div className="text-[10px] opacity-75">{ev.subtitle}</div>}
                      {ev.assignedTo && <div className="text-[10px] opacity-75">Assigned: {ev.assignedTo}</div>}
                    </div>
                    <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium bg-black/10">{ev.status}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
