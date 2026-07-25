// Scheduled sync endpoint — runs every 15 min via Vercel Cron (see vercel.json).
//
// Vercel Cron invokes this with a GET request and, when CRON_SECRET is set, an
// "Authorization: Bearer <CRON_SECRET>" header. External schedulers can use POST
// with either that Authorization header or "x-cron-secret: <CRON_SECRET>".

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { decryptField } from "@/lib/encrypt";
import { syncO365, type O365Config } from "@/lib/integrations/o365";

/** Returns true when the request carries the configured cron secret (or no secret is set). */
function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // no secret configured — allow (dev / trusted network)
  const incoming =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "");
  return incoming === cronSecret;
}

async function runO365Sync() {
  const prisma = getPrisma();
  const integrations = await prisma.integration.findMany({
    where: { type: "O365", enabled: true },
  });

  if (integrations.length === 0) {
    return { ok: true, message: "No enabled O365 integrations found.", results: [] as Record<string, unknown>[] };
  }

  const results: Record<string, unknown>[] = [];

  for (const integration of integrations) {
    if (!integration.tenantId || !integration.clientId || !integration.clientSecret) {
      results.push({ id: integration.id, name: integration.name, skipped: "missing credentials" });
      continue;
    }

    try {
      await prisma.integration.update({
        where: { id: integration.id },
        data:  { lastSyncStatus: "RUNNING" },
      });

      const clientSecret = decryptField(integration.clientSecret);
      const config = (integration.config ?? { contentTypes: ["Audit.AzureActiveDirectory"] }) as O365Config;

      const result = await syncO365(
        integration.tenantId,
        integration.clientId,
        clientSecret,
        config,
        integration.lastSyncAt,
      );

      await prisma.integration.update({
        where: { id: integration.id },
        data:  {
          lastSyncAt:     new Date(),
          lastSyncStatus: "SUCCESS",
          lastSyncError:  result.errors.length > 0 ? result.errors.join("; ") : null,
          eventCount:     { increment: result.eventsIngested },
        },
      });

      results.push({
        id:                 integration.id,
        name:               integration.name,
        eventsIngested:     result.eventsIngested,
        contentUrisFetched: result.contentUrisFetched,
        warnings:           result.errors,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.integration.update({
        where: { id: integration.id },
        data:  { lastSyncStatus: "ERROR", lastSyncError: msg },
      }).catch(() => {});
      results.push({ id: integration.id, name: integration.name, error: msg });
    }
  }

  return { ok: true, results };
}

// Vercel Cron uses GET. External schedulers can use POST. Both run the same sync.
export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runO365Sync());
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runO365Sync());
}
