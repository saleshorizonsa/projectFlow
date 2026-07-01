import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" as const, maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = "role" in user ? String((user as { role?: unknown }).role ?? "VIEWER") : "VIEWER";
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
