import { TeamForm } from "@/components/team/team-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export default async function NewTeamMemberPage() {
  const session = await auth();
  const companies = await getPrisma().company.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Add Team Member</CardTitle>
          <CardDescription>Create a login user, assign role, WhatsApp phone, and company support scope.</CardDescription>
        </CardHeader>
      </Card>
      {session?.user.role === "ADMIN" && <TeamForm companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))} />}
    </div>
  );
}
