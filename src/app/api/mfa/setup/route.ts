import { NextResponse } from "next/server";
import { z } from "zod";
import { verify } from "otplib";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { generateSecret, generateOtpAuthUrl, encryptSecret, generateBackupCodes, hashBackupCodes } from "@/lib/totp";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

// GET — generate a fresh TOTP secret for the current user (not yet saved)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = generateSecret();
  const otpAuthUrl = await generateOtpAuthUrl(session.user.email ?? session.user.id, secret);

  return NextResponse.json({ secret, otpAuthUrl });
}

const enableSchema = z.object({
  secret: z.string().min(10),
  totp: z.string().length(6).regex(/^\d{6}$/),
});

// POST — verify the TOTP code, then persist the secret and enable MFA
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = enableSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });

  const { secret, totp } = parsed.data;

  // Verify the TOTP against the plain secret (not yet encrypted — it's just been generated)
  const result = await verify({ token: totp, secret });
  if (!result.valid) {
    return NextResponse.json({ error: "Invalid code. Make sure your authenticator app is synced and try again." }, { status: 422 });
  }

  // Ensure not already enabled
  const existing = await getPrisma().user.findUnique({ where: { id: session.user.id }, select: { mfaEnabled: true } });
  if (existing?.mfaEnabled) {
    return NextResponse.json({ error: "MFA is already enabled." }, { status: 409 });
  }

  const backupCodes = generateBackupCodes(8);
  const hashedBackupCodes = await hashBackupCodes(backupCodes);

  await getPrisma().user.update({
    where: { id: session.user.id },
    data: { mfaSecret: encryptSecret(secret), mfaEnabled: true, mfaBackupCodes: hashedBackupCodes },
  });

  await audit({
    userId: session.user.id,
    action: "UPDATE",
    entity: "User",
    entityId: session.user.id,
    ip: getClientIp(request),
    detail: { event: "mfa_enabled" },
  });

  // Return plaintext backup codes ONE TIME — never retrievable again
  return NextResponse.json({ backupCodes });
}
