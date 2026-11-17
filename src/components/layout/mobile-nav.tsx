"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NavLink, useCompanyHref } from "@/components/layout/nav-link";
import { BRAND } from "@/lib/brand";
import { activeHref, isPathAllowed, MOBILE_TABS, visibleNavGroups, type NavAccess } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileNav({ role, disabledModules }: NavAccess) {
  const pathname = usePathname();
  const withCompany = useCompanyHref();
  const [moreOpen, setMoreOpen] = useState(false);

  const access = useMemo(() => ({ role, disabledModules }), [role, disabledModules]);
  const tabs = useMemo(() => MOBILE_TABS.filter((tab) => isPathAllowed(tab.href, access)), [access]);
  const groups = useMemo(() => visibleNavGroups(access), [access]);

  const currentTab = activeHref(pathname, tabs.map((tab) => tab.href));
  const currentHref = activeHref(pathname, groups.flatMap((group) => group.items.map((item) => item.href)));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-1 pb-2 pt-1 backdrop-blur lg:hidden" aria-label="Main">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={withCompany(tab.href)}
              aria-current={tab.href === currentTab ? "page" : undefined}
              className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0.5 text-[11px] font-medium leading-none text-muted-foreground",
                tab.href === currentTab && "bg-primary/10 text-primary",
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="w-full truncate text-center">{tab.label}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0.5 text-[11px] font-medium leading-none text-muted-foreground",
              !currentTab && "bg-primary/10 text-primary",
            )}
          >
            <LayoutGrid className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="bottom-0 left-0 top-auto max-h-[85vh] w-full max-w-none translate-x-0 translate-y-0 gap-3 overflow-y-auto rounded-b-none p-4 lg:hidden">
          <div>
            <DialogTitle className="text-base">{BRAND.name}</DialogTitle>
            <DialogDescription>{BRAND.tagline}</DialogDescription>
          </div>
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.key} className="space-y-1">
                <h3 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <group.icon className="h-3.5 w-3.5" />
                  {group.label}
                </h3>
                <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={item.href === currentHref}
                      onNavigate={() => setMoreOpen(false)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
