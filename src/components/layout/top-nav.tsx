import { auth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CompanyFilter } from "@/components/layout/company-filter";
import { GlobalSearch } from "@/components/layout/global-search";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getPrisma } from "@/lib/prisma";

export async function TopNav() {
  const session = await auth();
  const initials = session?.user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) ?? "U";
  const companies = await getPrisma().company.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur md:flex-nowrap md:px-6">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">JASCOMiyaar</div>
        <div className="truncate text-xs text-muted-foreground">Dashboard / Projects & Current State / Operational control</div>
      </div>
      <GlobalSearch />
      <div className="order-3 flex w-full items-center justify-between gap-2 md:order-none md:w-auto md:justify-end">
        <CompanyFilter companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))} />
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden sm:block">
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
