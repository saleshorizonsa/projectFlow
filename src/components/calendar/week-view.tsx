"use client";
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { EVENT_COLORS } from "@/lib/calendar-events";
import type { CalendarEvent } from "@/lib/calendar-events";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 – 22:00

export function WeekView({ events, date, onDayClick, onEventClick }: {
  events: CalendarEvent[];
  date: Date;
  onDayClick: (dateStr: string) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(date, { weekStartsOn: 1 });
  const days      = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const todayStr  = format(new Date(), "yyyy-MM-dd");

  function dayEvents(day: Date): CalendarEvent[] {
    const ds = format(day, "yyyy-MM-dd");
    return events.filter((e) => e.date === ds || (e.endDate && e.date <= ds && e.endDate >= ds));
  }

  function timedEvents(day: Date) { return dayEvents(day).filter((e) => e.timeLabel); }
  function allDayEvents(day: Date) { return dayEvents(day).filter((e) => !e.timeLabel); }

  function hourOf(timeLabel: string): number {
    return parseInt(timeLabel.split(":")[0], 10);
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* Day headers */}
      <div className="sticky top-0 z-10 grid bg-card border-b" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
        <div className="border-r" />
        {days.map((day) => {
          const ds = format(day, "yyyy-MM-dd");
          const isToday = ds === todayStr;
          return (
            <div key={ds} className="border-r py-2 text-center cursor-pointer hover:bg-muted/30" onClick={() => onDayClick(ds)}>
              <div className="text-[11px] font-medium text-muted-foreground">{format(day, "EEE")}</div>
              <div className={cn("mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", isToday && "bg-primary text-primary-foreground")}>
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day strip */}
      <div className="sticky top-[56px] z-10 grid border-b bg-muted/20 min-h-[36px]" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
        <div className="border-r px-1 py-1 text-[9px] text-muted-foreground">all-day</div>
        {days.map((day) => {
          const ds = format(day, "yyyy-MM-dd");
          return (
            <div key={ds} className="border-r px-0.5 py-0.5 space-y-0.5">
              {allDayEvents(day).map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className={cn("w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium", EVENT_COLORS[ev.type].bg, EVENT_COLORS[ev.type].text)}
                >
                  {ev.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid flex-1" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
        {/* Time labels column */}
        <div>
          {HOURS.map((h) => (
            <div key={h} className="h-14 border-b border-r px-1 pt-0.5 text-[10px] text-muted-foreground">{String(h).padStart(2, "0")}:00</div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const ds = format(day, "yyyy-MM-dd");
          const timed = timedEvents(day);
          return (
            <div key={ds} className="relative border-r">
              {HOURS.map((h) => (
                <div key={h} className="h-14 border-b" />
              ))}
              {/* Position timed events */}
              {timed.map((ev) => {
                const hour = ev.timeLabel ? hourOf(ev.timeLabel) : 6;
                const topPx = (hour - 6) * 56;
                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    style={{ top: topPx, height: 52 }}
                    className={cn(
                      "absolute inset-x-0.5 rounded border px-1 py-0.5 text-left text-[10px] font-medium overflow-hidden hover:opacity-80 z-10",
                      EVENT_COLORS[ev.type].bg, EVENT_COLORS[ev.type].text, EVENT_COLORS[ev.type].border,
                    )}
                  >
                    <div className="font-semibold">{ev.timeLabel}</div>
                    <div className="truncate">{ev.title}</div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
