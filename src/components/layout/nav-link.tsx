"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Keeps the selected company filter when moving between pages. */
export function useCompanyHref() {
  const company = useSearchParams().get("company");
  return (href: string) => (company ? `${href}?company=${company}` : href);
}

export function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed?: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const withCompany = useCompanyHref();
  return (
    <Link
      href={withCompany(href)}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground",
        active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && !!badge && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
