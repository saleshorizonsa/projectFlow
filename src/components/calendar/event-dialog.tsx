"use client";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EVENT_COLORS, EVENT_TYPE_LABELS } from "@/lib/calendar-events";
import type { CalendarEvent } from "@/lib/calendar-events";

export function EventDialog({ event, onClose }: { event: CalendarEvent | null; onClose: () => void }) {
  if (!event) return null;
  const colors = EVENT_COLORS[event.type];
  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2">
            <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", colors.bg, colors.text)}>
              {EVENT_TYPE_LABELS[event.type]}
            </span>
            <span className="leading-snug">{event.title}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {event.subtitle && <div className="text-muted-foreground">{event.subtitle}</div>}
          <div className="grid grid-cols-2 gap-2">
            <Info label="Date" value={event.date + (event.timeLabel ? ` at ${event.timeLabel}` : "")} />
            {event.endDate && <Info label="End Date" value={event.endDate} />}
            <Info label="Status" value={event.status} />
            {event.severity && <Info label="Severity" value={event.severity} />}
            {event.assignedTo && <Info label="Assigned To" value={event.assignedTo} />}
          </div>
          {event.isOverdue && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive font-medium">
              This item is overdue.
            </div>
          )}
          {event.isComplete && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              Completed.
            </div>
          )}
          <Button asChild className="w-full" variant="outline">
            <Link href={event.href} target="_blank" rel="noopener">
              <ExternalLink className="h-3.5 w-3.5" /> Open in {EVENT_TYPE_LABELS[event.type]}
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium capitalize">{value.toLowerCase().replace(/_/g, " ")}</div>
    </div>
  );
}
