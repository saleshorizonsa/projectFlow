"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, Bell, Building2, CalendarClock, ClipboardList, FolderKanban, Gauge, GitBranch, HardDrive, IdCard, Menu, ShieldAlert, TriangleAlert, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/components/layout/sidebar-store";

const navSections = [
  {
    label: "Control",
    items: [
      { href: "/dashboard", label: "Command Center", icon: Gauge },
      { href: "/workflow", label: "Process Workflow", icon: GitBranch },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/team", label: "Team & Roles", icon: Users },
      { href: "/employees", label: "Employees", icon: IdCard },
      { href: "/projects", label: "Projects", icon: FolderKanban },
    ],
  },
  {
    label: "Gap To Execution",
    items: [
      { href: "/gaps", label: "Gap Analysis", icon: TriangleAlert },
      { href: "/tasks", label: "Requirements & Tasks", icon: ClipboardList },
      { href: "/deadlines", label: "Execution Deadlines", icon: CalendarClock },
      { href: "/escalations", label: "Escalation Matrix", icon: ShieldAlert },
    ],
  },
  {
    label: "Results",
    items: [
      { href: "/reports", label: "Reports & Results", icon: FileText },
      { href: "/notifications", label: "Feedback Alerts", icon: Bell },
    ],
  },
  {
    label: "Shared Services",
    items: [
      { href: "/it-maintenance", label: "IT Maintenance", icon: HardDrive },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { collapsed, toggle } = useSidebarStore();
  const companyQuery = searchParams.get("company");

  return (
    <aside className={cn("hidden border-r bg-card transition-all duration-200 lg:flex lg:flex-col", collapsed ? "lg:w-20" : "lg:w-72")}>
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
          <div>
            <div className="text-sm font-semibold">PEGMS</div>
            <div className="text-xs text-muted-foreground">Execution control</div>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Collapse sidebar">
          <Menu className="h-4 w-4" />
        </Button>
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-1">
            {!collapsed && <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</div>}
            {section.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={companyQuery ? `${item.href}?company=${companyQuery}` : item.href}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
                    active && "bg-primary/10 text-primary",
                    collapsed && "justify-center px-0",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t p-4">
        <div className={cn("flex items-center gap-3 text-xs text-muted-foreground", collapsed && "justify-center")}>
          <BarChart3 className="h-4 w-4" />
          {!collapsed && <span>Deadline, gap and health tracking</span>}
        </div>
      </div>
    </aside>
  );
}
