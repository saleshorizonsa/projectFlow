"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NavLink } from "@/components/layout/nav-link";
import { useSidebarStore } from "@/components/layout/sidebar-store";
import { BRAND } from "@/lib/brand";
import { activeHref, visibleNavGroups, type NavAccess, type NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type BadgeCounts = {
  openIncidents?: number;
  criticalVulns?: number;
  highRisks?: number;
  overdueTasks?: number;
  unreadNotifications?: number;
  securityAlerts?: number;
};

const BADGE_MAP: Record<string, keyof BadgeCounts> = {
  "/incident-response": "openIncidents",
  "/vulnerability-management": "criticalVulns",
  "/risk-register": "highRisks",
  "/tasks": "overdueTasks",
  "/notifications": "unreadNotifications",
  "/security-events": "securityAlerts",
};

export function Sidebar({ role, disabledModules }: NavAccess) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarStore();
  const [query, setQuery] = useState("");
  // Explicit open/closed choices; groups without one follow the default (home + active group open).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [badges, setBadges] = useState<BadgeCounts>({});

  useEffect(() => {
    fetch("/api/badges")
      .then((r) => r.json())
      .then(setBadges)
      .catch(() => {});
  }, []);

  const groups = useMemo(() => visibleNavGroups({ role, disabledModules }), [role, disabledModules]);
  const currentHref = activeHref(pathname, groups.flatMap((group) => group.items.map((item) => item.href)));
  const activeGroupKey = groups.find((group) => group.items.some((item) => item.href === currentHref))?.key;

  // Keep the group you navigate into open, even if it was collapsed earlier.
  useEffect(() => {
    if (activeGroupKey) setOpenGroups((current) => ({ ...current, [activeGroupKey]: true }));
  }, [activeGroupKey]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => `${group.label} ${item.label}`.toLowerCase().includes(normalizedQuery)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, normalizedQuery]);

  const mainGroups = filteredGroups.filter((group) => group.key !== "settings");
  const settingsGroup = filteredGroups.find((group) => group.key === "settings");

  function badgeFor(href: string) {
    const key = BADGE_MAP[href];
    return key ? badges[key] : undefined;
  }

  function isOpen(group: NavGroup) {
    if (collapsed || normalizedQuery) return true;
    return openGroups[group.key] ?? (group.key === "home" || group.key === activeGroupKey);
  }

  function toggleGroup(group: NavGroup) {
    setOpenGroups((current) => ({ ...current, [group.key]: !isOpen(group) }));
  }

  function renderGroup(group: NavGroup) {
    // A group with a single page is shown as a plain link, not a collapsible section.
    if (group.items.length === 1) {
      const item = group.items[0];
      return (
        <NavLink
          key={group.key}
          href={item.href}
          label={group.label}
          icon={group.icon}
          active={item.href === currentHref}
          collapsed={collapsed}
          badge={badgeFor(item.href)}
        />
      );
    }

    const open = isOpen(group);
    return (
      <div key={group.key} className="space-y-0.5">
        {collapsed ? (
          <div className="mx-auto my-2 h-px w-8 bg-border" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={() => toggleGroup(group)}
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold text-foreground hover:bg-accent",
              group.key === activeGroupKey && "text-primary",
            )}
            aria-expanded={open}
          >
            <group.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{group.label}</span>
            <ChevronDown className={cn("ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
          </button>
        )}
        {open && (
          <div className={cn("space-y-0.5", !collapsed && "ml-4 border-l pl-2")}>
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={item.href === currentHref}
                collapsed={collapsed}
                badge={badgeFor(item.href)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className={cn("sticky top-0 hidden h-screen border-r bg-card transition-all duration-200 lg:flex lg:flex-col", collapsed ? "lg:w-20" : "lg:w-72")}>
      <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b px-4", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-base font-bold tracking-tight">{BRAND.name}</div>
            <div className="truncate text-xs text-muted-foreground">{BRAND.tagline}</div>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <Menu className="h-4 w-4" />
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {!collapsed && (
          <div className="sticky top-0 z-10 bg-card py-3">
            <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search menu"
                aria-label="Search menu"
                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        )}
        <div className={cn("flex flex-col gap-1", collapsed && "pt-3")}>
          {mainGroups.map(renderGroup)}
          {!collapsed && normalizedQuery && filteredGroups.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No pages match “{query.trim()}”.</p>
          )}
        </div>
      </nav>
      {settingsGroup && (
        <div className="max-h-[45%] shrink-0 overflow-y-auto border-t px-3 py-3">{renderGroup(settingsGroup)}</div>
      )}
    </aside>
  );
}
