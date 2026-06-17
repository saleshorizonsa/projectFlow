"use client";
import { format, getDaysInMonth, getDay, startOfMonth } from "date-fns";
import type { CalendarEvent } from "@/lib/calendar-events";
import { EVENT_COLORS } from "@/lib/calendar-events";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function dayColor(dayEvents: CalendarEvent[]): string {
  if (!dayEvents.length) return "bg-muted/40";
  if (dayEvents.some((e) => e.isOverdue)) return "bg-red-500/70";
  if (dayEvents.some((e) => e.severity === "CRITICAL" || e.severity === "HIGH")) return "bg-amber-500/70";
  const count = dayEvents.length;
  if (count >= 5) return "bg-primary/80";
  if (count >= 3) return "bg-primary/50";
  if (count >= 1) return "bg-primary/25";
  return "bg-muted/40";
}

export function YearView({ events, date, onDayClick, onEventClick }: {
  events: CalendarEvent[];
  date: Date;
  onDayClick: (dateStr: string) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const year = date.getFullYear();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Group events by date
  const byDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    const d = ev.date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(ev);
  }

  return (
    <div className="grid grid-cols-2 gap-6 p-6 md:grid-cols-3 xl:grid-cols-4">
      {MONTHS.map((monthName, mi) => {
        const daysInMonth = getDaysInMonth(new Date(year, mi, 1));
        // Monday-start: getDay returns 0=Sun,1=Mon...6=Sat → convert to Mon=0
        const firstDow = (getDay(startOfMonth(new Date(year, mi, 1))) + 6) % 7;
        const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
        // pad to full weeks
        while (cells.length % 7 !== 0) cells.push(null);

        return (
          <div key={mi} className="rounded-lg border bg-card p-3">
            <div className="mb-2 text-xs font-semibold">{monthName} {year}</div>
            <div className="grid grid-cols-7 gap-0.5">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[9px] font-medium text-muted-foreground pb-1">{d}</div>
              ))}
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const dateStr = format(new Date(year, mi, day), "yyyy-MM-dd");
                const dayEvts = byDate[dateStr] ?? [];
                const isToday = dateStr === todayStr;
                return (
                  <button
                    key={idx}
                    title={dayEvts.length > 0 ? `${dayEvts.length} event(s)` : undefined}
                    onClick={() => onDayClick(dateStr)}
                    className={cn(
                      "flex h-5 w-full items-center justify-center rounded-sm text-[9px] font-medium transition-all hover:ring-1 hover:ring-primary",
                      dayColor(dayEvts),
                      isToday && "ring-1 ring-primary font-bold",
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            {/* Month event summary */}
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(
                events
                  .filter((e) => parseInt(e.date.slice(5, 7)) - 1 === mi && e.date.startsWith(String(year)))
                  .reduce((acc: Record<string, number>, e) => ({ ...acc, [e.type]: (acc[e.type] ?? 0) + 1 }), {})
              ).map(([type, count]) => (
                <span key={type} className={cn("rounded px-1 text-[9px] font-medium", EVENT_COLORS[type as keyof typeof EVENT_COLORS].bg, EVENT_COLORS[type as keyof typeof EVENT_COLORS].text)}>
                  {count}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
