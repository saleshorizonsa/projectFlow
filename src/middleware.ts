import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/whatsapp",
  "/api/automation",
  "/api/vulnerabilities/webhook",
  "/api/public",
  "/public",   // no-auth landing pages (asset, employee) reachable via QR scan
  "/api/cron",
];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isPublic = PUBLIC_PREFIXES.some((p) => nextUrl.pathname.startsWith(p));

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
