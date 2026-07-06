"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const PREF_KEY = "horizon-dashboard-sections";

export const DASHBOARD_SECTIONS = [
  { id: "stats",     label: "KPI Stats" },
  { id: "security",  label: "Security Posture" },
  { id: "analytics", label: "Analytics Charts" },
  { id: "resources", label: "Resource Allocation" },
  { id: "health",    label: "Project Health & Deadlines" },
] as const;

function getPrefs(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function DashboardSection({ id, children }: { id: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    function check() {
      const p = getPrefs();
      setVisible(p[id] !== false);
    }
    check();
    window.addEventListener("dashboard-prefs-changed", check);
    return () => window.removeEventListener("dashboard-prefs-changed", check);
  }, [id]);

  if (!visible) return null;
  return <>{children}</>;
}

export function DashboardCustomizeButton() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) setPrefs(getPrefs());
  }, [open]);

  function toggle(id: string) {
    setPrefs(p => ({ ...p, [id]: p[id] === false }));
  }

  function save() {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event("dashboard-prefs-changed"));
    setOpen(false);
  }

  function resetAll() {
    setPrefs({});
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Customize dashboard">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <p className="text-sm text-muted-foreground">Show or hide sections on this page.</p>
        </DialogHeader>
        <div className="space-y-1 py-1">
          {DASHBOARD_SECTIONS.map(s => (
            <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-md p-3 hover:bg-muted">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                checked={prefs[s.id] !== false}
                onChange={() => toggle(s.id)}
              />
              <span className="text-sm font-medium">{s.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={save} className="flex-1">Save</Button>
          <Button variant="outline" onClick={resetAll}>Show All</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
