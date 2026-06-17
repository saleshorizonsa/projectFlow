import { Search } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompanyFilter } from "@/components/layout/company-filter";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getPrisma } from "@/lib/prisma";

export async function TopNav() {
  const session = await auth();
  const initials = session?.user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) ?? "U";
  const companies = await getPrisma().company.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur md:flex-nowrap md:px-6">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">ProjectFlow</div>
        <div className="truncate text-xs text-muted-foreground">Dashboard / Projects & Current State / Operational control</div>
      </div>
      <div className="hidden w-full max-w-sm items-center gap-2 rounded-md border bg-card px-3 md:flex">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input className="border-0 px-0 shadow-none focus-visible:ring-0" placeholder="Search projects, current state, gaps, tasks" />
      </div>
      <div className="order-3 flex w-full items-center justify-between gap-2 md:order-none md:w-auto md:justify-end">
        <CompanyFilter companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))} />
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <form className="hidden sm:block"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="outline" size="sm">Sign out</Button>
          </form>
        </div>
      </div>
    </header>
  );
}
