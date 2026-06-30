import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

const schema = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Password required" }, { status: 400 });

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, mfaEnabled: true },
  });

  if (!user?.mfaEnabled) return NextResponse.json({ error: "MFA is not enabled." }, { status: 400 });

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash ?? "");
  if (!valid) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });

  await getPrisma().user.update({
    where: { id: session.user.id },
    data: { mfaSecret: null, mfaEnabled: false, mfaBackupCodes: [] },
  });

  await audit({
    userId: session.user.id,
    action: "UPDATE",
    entity: "User",
    entityId: session.user.id,
    ip: getClientIp(request),
    detail: { event: "mfa_disabled" },
  });

  return NextResponse.json({ ok: true });
}
