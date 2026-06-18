import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authConfig = {
  adapter: PrismaAdapter(getPrisma()),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const credentials = credentialsSchema.safeParse(rawCredentials);
        if (!credentials.success) return null;

        const user = await getPrisma().user.findUnique({
          where: { email: credentials.data.email },
          include: { role: true },
        });

        if (!user?.passwordHash) return null;
        const valid = await bcrypt.compare(credentials.data.password, user.passwordHash);
        if (!valid) return null;

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
    async jwt({ token, user }) {
      if (user) {
        token.role = "role" in user ? user.role : "VIEWER";
        token.roleCheckedAt = Date.now();
      } else if (token.sub) {
        // Re-verify role from DB at most once every 5 minutes per session
        const lastChecked = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
        if (Date.now() - lastChecked > 5 * 60 * 1000) {
          const dbUser = await getPrisma().user.findUnique({
            where: { id: token.sub },
            select: { role: { select: { name: true } } },
          });
          token.role = dbUser?.role.name ?? undefined;
          token.roleCheckedAt = Date.now();
        }
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
