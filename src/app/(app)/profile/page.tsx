import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MfaSetup } from "@/components/auth/mfa-setup";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      mfaEnabled: true,
      lastLoginAt: true,
      lastLoginIp: true,
      role: { select: { name: true } },
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <p className="text-sm text-muted-foreground">Account settings and security for {user.email}</p>
      </div>

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email ?? "—"} />
          <Row label="Phone" value={user.phone ?? "—"} />
          <Row label="Role">
            <Badge variant="secondary">{user.role.name}</Badge>
          </Row>
          {user.lastLoginAt && (
            <Row label="Last sign-in" value={`${format(user.lastLoginAt, "d MMM yyyy, HH:mm")} · IP ${user.lastLoginIp ?? "unknown"}`} />
          )}
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
          <CardDescription>Two-factor authentication protects your account even if your password is compromised.</CardDescription>
        </CardHeader>
        <CardContent>
          <MfaSetup mfaEnabled={user.mfaEnabled} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      {children ?? <span className="font-medium">{value}</span>}
    </div>
  );
}
