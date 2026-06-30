import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { verifyTotp, verifyAndConsumeBackupCode } from "@/lib/totp";

const LOCK_AFTER_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
  ip: z.string().optional(),
});

export const authConfig = {
  adapter: PrismaAdapter(getPrisma()),
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8-hour absolute timeout
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "Authenticator Code", type: "text" },
        ip: { label: "IP", type: "text" },
      },
      async authorize(rawCredentials) {
        const credentials = credentialsSchema.safeParse(rawCredentials);
        if (!credentials.success) return null;

        const { email, password, totp, ip } = credentials.data;

        const user = await getPrisma().user.findUnique({
          where: { email },
          include: { role: true },
        });

        // Account lockout check
        if (user?.lockedUntil && user.lockedUntil > new Date()) {
          await audit({ userId: user.id, action: "LOGIN_BLOCKED", ip, detail: { email } });
          return null;
        }

        // Timing-safe: always run bcrypt even if user not found
        const hash = user?.passwordHash ?? "$2b$12$invalidhashtopreventtimingattack";
        const valid = await bcrypt.compare(password, hash);

        if (!user || !valid) {
          if (user) {
            const attempts = (user.failedLoginAttempts ?? 0) + 1;
            const shouldLock = attempts >= LOCK_AFTER_ATTEMPTS;
            await getPrisma().user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: attempts,
                ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) } : {}),
              },
            });
            await audit({
              userId: user.id,
              action: shouldLock ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
              ip,
              detail: { email, attempt: attempts },
            });
          }
          return null;
        }

        // MFA verification
        if (user.mfaEnabled) {
          if (!totp) {
            // MFA required but not provided — client should call /api/auth/check-mfa first
            return null;
          }

          // Try TOTP first, then backup code
          let mfaPassed = false;
          if (/^\d{6}$/.test(totp) && user.mfaSecret) {
            mfaPassed = await verifyTotp(totp, user.mfaSecret);
          }

          if (!mfaPassed && user.mfaBackupCodes.length > 0) {
            const result = await verifyAndConsumeBackupCode(totp, user.mfaBackupCodes);
            if (result.valid) {
              mfaPassed = true;
              // Consume the backup code immediately
              await getPrisma().user.update({
                where: { id: user.id },
                data: { mfaBackupCodes: result.remaining },
              });
              await audit({ userId: user.id, action: "LOGIN_SUCCESS", ip, detail: { email, method: "backup_code" } });
            }
          }

          if (!mfaPassed) {
            await audit({ userId: user.id, action: "LOGIN_FAILED", ip, detail: { email, reason: "invalid_totp" } });
            return null;
          }
        }

        // Full success — reset lockout state and record login
        await getPrisma().user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            lastLoginIp: ip ?? null,
          },
        });

        await audit({ userId: user.id, action: "LOGIN_SUCCESS", ip, detail: { email, method: user.mfaEnabled ? "totp" : "password" } });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role.name,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = "role" in user ? user.role : "VIEWER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = String(token.role ?? "VIEWER");
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
