import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TopNav } from "@/components/layout/top-nav";
import { auth } from "@/lib/auth";
import { getDisabledModules } from "@/lib/modules";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role ?? "VIEWER";
  const disabledModules = await getDisabledModules();

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} disabledModules={disabledModules} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav role={role} disabledModules={disabledModules} />
        <main className="flex-1 p-3 pb-20 sm:p-4 md:p-6 lg:pb-6">{children}</main>
        <MobileNav role={role} disabledModules={disabledModules} />
      </div>
    </div>
  );
}
