"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BarChart2, BarChart3, Bell, BookOpen, Bot, Building2, Bug, Calendar, CalendarClock, ChevronDown, ClipboardList, DatabaseBackup, Flag, FolderKanban, Gauge, GitBranch, HardDrive, IdCard, KeyRound, LifeBuoy, Menu, Search, Shield, ShieldAlert, Siren, TriangleAlert, FileText, Users, UserCircle, ScrollText, AlertTriangle, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/components/layout/sidebar-store";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Command Center", icon: Gauge },
    ],
  },
  {
    label: "Organisation Setup",
    items: [
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/companies/new", label: "Add Company", icon: Building2 },
      { href: "/team", label: "Team & Roles", icon: Users },
      { href: "/team/new", label: "Add Team Member", icon: Users },
      { href: "/employees", label: "Employees", icon: IdCard },
    ],
  },
  {
    label: "Projects & Planning",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/projects/new", label: "Create Project", icon: FolderKanban },
      { href: "/workflow", label: "Process Workflow", icon: GitBranch },
      { href: "/milestones", label: "Milestones", icon: Flag },
    ],
  },
  {
    label: "Task Management",
    items: [
      { href: "/tasks", label: "Task Register", icon: ClipboardList },
      { href: "/tasks/new", label: "Create Task", icon: ClipboardList },
    ],
  },
  {
    label: "Gap & Execution",
    items: [
      { href: "/gaps", label: "Gap Analysis", icon: TriangleAlert },
      { href: "/deadlines", label: "Execution Deadlines", icon: CalendarClock },
      { href: "/escalations", label: "Escalation Matrix", icon: ShieldAlert },
    ],
  },
  {
    label: "IT Operations",
    items: [
      { href: "/it-maintenance", label: "IT Overview", icon: HardDrive },
      { href: "/it-maintenance/assets", label: "Assets & Apps", icon: HardDrive },
      { href: "/it-maintenance/maintenance", label: "Maintenance Windows", icon: CalendarClock },
      { href: "/it-maintenance/licenses", label: "Licenses & Renewals", icon: KeyRound },
      { href: "/it-maintenance/licenses/new", label: "Add License", icon: KeyRound },
      { href: "/it-maintenance/licenses/renewals", label: "Renewal Risks", icon: TriangleAlert },
      { href: "/calendar", label: "IT Operations Calendar", icon: Calendar },
      { href: "/resources", label: "Resource Allocation", icon: Users },
      { href: "/automation", label: "Automation Center", icon: Bot },
    ],
  },
  {
    label: "IT Support",
    items: [
      { href: "/support", label: "Support Overview", icon: LifeBuoy },
      { href: "/support/new", label: "Log Support Ticket", icon: LifeBuoy },
      { href: "/support/tickets", label: "Ticket Register", icon: LifeBuoy },
    ],
  },
  {
    label: "Cybersecurity & Compliance",
    items: [
      { href: "/compliance", label: "Compliance Dashboard", icon: CheckSquare },
      { href: "/risk-register", label: "Risk Register", icon: AlertTriangle },
      { href: "/vulnerability-management", label: "Vulnerability Management", icon: Bug },
      { href: "/backup-monitoring", label: "Backup Monitoring", icon: DatabaseBackup },
      { href: "/policy-management", label: "Policy Management", icon: FileText },
      { href: "/incident-response", label: "Incident Response", icon: Siren },
      { href: "/playbooks", label: "IR Playbooks", icon: BookOpen },
      { href: "/audit", label: "Audit Log & Evidence", icon: ScrollText },
    ],
  },
  {
    label: "Reports & Insights",
    items: [
      { href: "/reports", label: "Reports & Analytics", icon: BarChart2 },
      { href: "/notifications", label: "Feedback & Alerts", icon: Bell },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/users", label: "User Management", icon: Shield },
      { href: "/profile", label: "My Profile & Security", icon: UserCircle },
    ],
  },
];

type BadgeCounts = {
  openIncidents?: number;
  criticalVulns?: number;
  highRisks?: number;
  overdueTasks?: number;
  unreadNotifications?: number;
};

const BADGE_MAP: Record<string, keyof BadgeCounts> = {
  "/incident-response": "openIncidents",
  "/vulnerability-management": "criticalVulns",
  "/risk-register": "highRisks",
  "/tasks": "overdueTasks",
  "/notifications": "unreadNotifications",
};

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { collapsed, toggle } = useSidebarStore();
  const companyQuery = searchParams.get("company");
  const [query, setQuery] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Overview: true,
    "Task Management": true,
  });
  const [badges, setBadges] = useState<BadgeCounts>({});

  useEffect(() => {
    fetch("/api/badges")
      .then((r) => r.json())
      .then(setBadges)
      .catch(() => {});
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return navSections;
    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          `${section.label} ${item.label} ${item.href}`.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [normalizedQuery]);

  return (
    <aside className={cn("sticky top-0 hidden h-screen border-r bg-card transition-all duration-200 lg:flex lg:flex-col", collapsed ? "lg:w-20" : "lg:w-72")}>
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        {!collapsed && (
          <div>
            <div className="text-sm font-semibold">HorizonMiyaar</div>
            <div className="text-xs text-muted-foreground">Execution control</div>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Collapse sidebar">
          <Menu className="h-4 w-4" />
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {!collapsed && (
          <div className="sticky top-0 z-10 mb-4 bg-card pb-3">
            <div className="flex h-10 items-center gap-2 rounded-md border bg-background px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search navigation"
                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-4">
        {filteredSections.map((section) => (
          <div key={section.label} className="space-y-1">
            {(() => {
              const exactRoutes = ["/it-maintenance", "/support", "/companies", "/team", "/projects"];
              const sectionHasActiveItem = section.items.some((item) => exactRoutes.includes(item.href) ? pathname === item.href : pathname.startsWith(item.href));
              const sectionOpen = collapsed || normalizedQuery.length > 0 || sectionHasActiveItem || openSections[section.label];
              return (
                <>
                  {!collapsed && (
                    <button
                      type="button"
                      onClick={() => setOpenSections((current) => ({ ...current, [section.label]: !current[section.label] }))}
                      className="flex h-8 w-full items-center justify-between rounded-md px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-expanded={sectionOpen}
                    >
                      <span className="truncate">{section.label}</span>
                      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !sectionOpen && "-rotate-90")} />
                    </button>
                  )}
                  {sectionOpen && section.items.map((item) => {
              const active = exactRoutes.includes(item.href) ? pathname === item.href : pathname.startsWith(item.href);
              const badgeKey = BADGE_MAP[item.href];
              const badgeCount = badgeKey ? (badges[badgeKey] ?? 0) : 0;
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
                  {!collapsed && badgeCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
                </>
              );
            })()}
          </div>
        ))}
        </div>
      </nav>
      <div className="shrink-0 border-t p-4">
        <div className={cn("flex items-center gap-3 text-xs text-muted-foreground", collapsed && "justify-center")}>
          <BarChart3 className="h-4 w-4" />
          {!collapsed && <span>Deadline, gap and health tracking</span>}
        </div>
      </div>
    </aside>
  );
}
