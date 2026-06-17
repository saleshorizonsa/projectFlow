"use client";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { EVENT_COLORS } from "@/lib/calendar-events";
import type { CalendarEvent } from "@/lib/calendar-events";

const DAY_HEADERS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export function MonthView({ events, date, onDayClick, onEventClick, onDayDoubleClick }: {
  events: CalendarEvent[];
  date: Date;
  onDayClick: (dateStr: string) => void;
  onEventClick: (e: CalendarEvent) => void;
  onDayDoubleClick: (dateStr: string) => void;
}) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const monthStart = startOfMonth(date);
  const monthEnd   = endOfMonth(date);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const todayStr   = format(new Date(), "yyyy-MM-dd");

  // Group events by date
  const byDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (!byDate[ev.date]) byDate[ev.date] = [];
    byDate[ev.date].push(ev);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="py-2 text-center text-xs font-semibold text-muted-foreground">{h}</div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid flex-1 grid-cols-7 grid-rows-[repeat(6,minmax(0,1fr))]">
        {days.map((day) => {
          const dateStr   = format(day, "yyyy-MM-dd");
          const dayEvts   = byDate[dateStr] ?? [];
          const inMonth   = isSameMonth(day, date);
          const isToday   = dateStr === todayStr;
          const visible   = dayEvts.slice(0, 3);
          const overflow  = dayEvts.length - 3;
          const expanded  = expandedDay === dateStr;

          return (
            <div
              key={dateStr}
              className={cn(
                "relative flex min-h-[80px] flex-col border-b border-r p-1.5 transition-colors",
                !inMonth && "bg-muted/20",
                isToday && "bg-primary/5",
              )}
              onClick={() => onDayClick(dateStr)}
              onDoubleClick={() => onDayDoubleClick(dateStr)}
            >
              <div className={cn(
                "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                isToday && "bg-primary text-primary-foreground",
                !inMonth && "text-muted-foreground",
              )}>
                {format(day, "d")}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {(expanded ? dayEvts : visible).map((ev) => (
                  <EventPill key={ev.id} event={ev} onClick={(e) => { e.stopPropagation(); onEventClick(ev); }} />
                ))}
                {!expanded && overflow > 0 && (
                  <button
                    className="text-left text-[10px] font-medium text-primary hover:underline"
                    onClick={(e) => { e.stopPropagation(); setExpandedDay(dateStr); }}
                  >
                    +{overflow} more
                  </button>
                )}
                {expanded && (
                  <button
                    className="text-left text-[10px] font-medium text-muted-foreground hover:underline"
                    onClick={(e) => { e.stopPropagation(); setExpandedDay(null); }}
                  >
                    show less
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventPill({ event, onClick }: { event: CalendarEvent; onClick: (e: React.MouseEvent) => void }) {
  const colors = EVENT_COLORS[event.type];
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium leading-4 transition-opacity hover:opacity-80",
        colors.bg, colors.text,
        event.isOverdue && "ring-1 ring-red-500",
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colors.dot)} />
      <span className="truncate">{event.timeLabel ? `${event.timeLabel} ` : ""}{event.title}</span>
    </button>
  );
}
