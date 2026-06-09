import { auth } from "@/lib/auth";

const roleRank = {
  VIEWER: 0,
  TEAM_MEMBER: 1,
  PROJECT_MANAGER: 2,
  ADMIN: 3,
} as const;

export async function requireRole(required: keyof typeof roleRank) {
  const session = await auth();
  const role = session?.user?.role as keyof typeof roleRank | undefined;
  if (!session?.user || !role || roleRank[role] < roleRank[required]) {
    throw new Response("Forbidden", { status: 403 });
  }
  return session;
}
