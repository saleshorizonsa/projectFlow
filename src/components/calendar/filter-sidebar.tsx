"use client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EVENT_COLORS, EVENT_TYPE_LABELS, type CalendarEventType } from "@/lib/calendar-events";
import type { Filters } from "@/components/calendar/calendar-shell";

const ALL_TYPES: CalendarEventType[] = ["maintenance", "license", "asset", "milestone", "task", "gap", "resource"];

export function FilterSidebar({ filters, onChange, companies, onClose }: {
  filters: Filters;
  onChange: (f: Filters) => void;
  companies: { id: string; name: string }[];
  onClose: () => void;
}) {
  function toggleType(type: CalendarEventType) {
    const types = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    onChange({ ...filters, types });
  }

  return (
    <aside className="w-56 shrink-0 overflow-y-auto border-r bg-card px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold">Filters</span>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6"><X className="h-3 w-3" /></Button>
      </div>

      <div className="space-y-4">
        {/* Event types */}
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Event Types</Label>
          <div className="mt-2 space-y-1.5">
            {ALL_TYPES.map((type) => {
              const active = filters.types.length === 0 || filters.types.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
                    active ? cn(EVENT_COLORS[type].bg, EVENT_COLORS[type].text) : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full shrink-0", EVENT_COLORS[type].dot)} />
                  {EVENT_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
          {filters.types.length > 0 && (
            <button className="mt-1 text-[10px] text-primary hover:underline" onClick={() => onChange({ ...filters, types: [] })}>
              Clear type filter
            </button>
          )}
        </div>

        {/* Company filter */}
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Company</Label>
          <Select value={filters.companyId || "all"} onValueChange={(v) => onChange({ ...filters, companyId: v === "all" ? "" : v })}>
            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Show completed */}
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Visibility</Label>
          <button
            onClick={() => onChange({ ...filters, showCompleted: !filters.showCompleted })}
            className={cn("mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium", filters.showCompleted ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            <span className={cn("h-2 w-2 rounded-full", filters.showCompleted ? "bg-emerald-500" : "bg-muted-foreground")} />
            {filters.showCompleted ? "Showing completed" : "Hiding completed"}
          </button>
        </div>

        {/* Reset all */}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => onChange({ types: [], companyId: "", showCompleted: true })}
        >
          Reset all filters
        </Button>
      </div>
    </aside>
  );
}
