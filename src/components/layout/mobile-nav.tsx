"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarClock, ClipboardList, Gauge, GitBranch, HardDrive, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Gauge },
  { href: "/workflow", label: "Flow", icon: GitBranch },
  { href: "/gaps", label: "Gaps", icon: TriangleAlert },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/deadlines", label: "Due", icon: CalendarClock },
  { href: "/it-maintenance", label: "IT", icon: HardDrive },
];

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const companyQuery = searchParams.get("company");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-1 pb-2 pt-1 backdrop-blur lg:hidden">
      <div className="grid grid-cols-6 gap-0.5">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={companyQuery ? `${item.href}?company=${companyQuery}` : item.href}
              className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0.5 text-[10px] font-medium leading-none text-muted-foreground",
                active && "bg-primary/10 text-primary",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
