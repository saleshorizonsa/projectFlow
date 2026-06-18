import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { UsersTable } from "@/components/admin/users-table";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const prisma = getPrisma();
  const [users, roles, companies] = await Promise.all([
    prisma.user.findMany({
      include: { role: true, companies: { include: { company: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="text-sm text-muted-foreground">Create and manage user accounts and roles.</p>
      </div>
      <UsersTable
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone ?? "",
          image: u.image ?? null,
          roleId: u.roleId,
          roleName: u.role.name,
          companies: u.companies.map((uc) => ({
            id: uc.company.id,
            name: uc.company.name,
            code: uc.company.code,
          })),
          createdAt: u.createdAt.toISOString(),
        }))}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
        currentUserId={session.user.id}
      />
    </div>
  );
}
