"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, LogOut, Plus, UserCircle } from "lucide-react";
import { SignOutDialog } from "@/components/auth/sign-out-button";
import { useCompanyHref } from "@/components/layout/nav-link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BRAND } from "@/lib/brand";
import { breadcrumbFor, visibleCreateActions, type NavAccess } from "@/lib/navigation";
import { formatEnum } from "@/lib/utils";

export function Breadcrumbs() {
  const pathname = usePathname();
  const withCompany = useCompanyHref();
  const crumb = breadcrumbFor(pathname);
  const title = crumb ? (crumb.sub ? `${crumb.title} · ${crumb.sub}` : crumb.title) : BRAND.name;

  return (
    <div className="min-w-0">
      <h1 className="truncate text-sm font-semibold">{title}</h1>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <Link href={withCompany("/dashboard")} className="shrink-0 hover:text-foreground">{BRAND.name}</Link>
        {crumb && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="truncate">{crumb.group}</span>
          </>
        )}
        {crumb?.sub && crumb.href && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <Link href={withCompany(crumb.href)} className="truncate hover:text-foreground">{crumb.title}</Link>
          </>
        )}
      </nav>
    </div>
  );
}

export function CreateMenu(access: NavAccess) {
  const withCompany = useCompanyHref();
  const actions = visibleCreateActions(access);
  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" aria-label="Create">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Create new</DropdownMenuLabel>
        {actions.map((action) => (
          <DropdownMenuItem key={action.href} asChild>
            <Link href={withCompany(action.href)}>
              <action.icon className="h-4 w-4 text-muted-foreground" />
              {action.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenu({ name, email, role }: { name: string; email: string; role: string }) {
  const [signOutOpen, setSignOutOpen] = useState(false);
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <div className="px-2 py-1.5">
            <div className="truncate text-sm font-semibold">{name || "User"}</div>
            {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
            <div className="mt-1 text-xs text-muted-foreground">{formatEnum(role)}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              My Profile & Security
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSignOutOpen(true)}>
            <LogOut className="h-4 w-4 text-muted-foreground" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </>
  );
}
