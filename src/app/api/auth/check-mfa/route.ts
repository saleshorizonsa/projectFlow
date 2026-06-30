import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Returns whether the user requires a TOTP step, after validating credentials.
// Deliberately identical response for wrong-email vs wrong-password to prevent enumeration.
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`check-mfa:${ip}`, 10, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { email, password } = parsed.data;

  const user = await getPrisma().user.findUnique({ where: { email } });

  // Always run bcrypt even if user not found (timing-safe)
  const hash = user?.passwordHash ?? "$2b$12$invalidhashtopreventtimingattack";
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json({ error: "Account locked. Try again later." }, { status: 423 });
  }

  return NextResponse.json({ mfaRequired: user.mfaEnabled });
}
