import { auth } from "@/lib/auth";
import { CompanyFilter } from "@/components/layout/company-filter";
import { GlobalSearch } from "@/components/layout/global-search";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Breadcrumbs, CreateMenu, UserMenu } from "@/components/layout/top-nav-menus";
import type { NavAccess } from "@/lib/navigation";
import { getPrisma } from "@/lib/prisma";

export async function TopNav({ role, disabledModules }: NavAccess) {
  const session = await auth();
  const companies = await getPrisma().company.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur md:flex-nowrap md:px-6">
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <GlobalSearch />
      <div className="order-3 flex w-full items-center justify-between gap-2 md:order-none md:w-auto md:justify-end">
        <CompanyFilter companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))} />
        <div className="flex shrink-0 items-center gap-2">
          <CreateMenu role={role} disabledModules={disabledModules} />
          <ThemeToggle />
          <UserMenu name={session?.user?.name ?? ""} email={session?.user?.email ?? ""} role={role} />
        </div>
      </div>
    </header>
  );
}
