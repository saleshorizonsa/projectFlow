// Scheduled sync for ALL enabled SIEM integrations — runs every 15 min via
// Vercel Cron (see vercel.json). Dispatches each integration to its provider
// sync via runIntegrationSync.
//
// Vercel Cron invokes this with GET and, when CRON_SECRET is set, an
// "Authorization: Bearer <CRON_SECRET>" header. External schedulers can use POST
// with that header or "x-cron-secret: <CRON_SECRET>".

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { runIntegrationSync, SYNCABLE_TYPES } from "@/lib/integrations/sync";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // no secret configured — allow (dev / trusted network)
  const incoming =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "");
  return incoming === cronSecret;
}

async function runAll() {
  const prisma = getPrisma();
  const integrations = await prisma.integration.findMany({
    where: { enabled: true, type: { in: [...SYNCABLE_TYPES] } },
  });

  if (integrations.length === 0) {
    return { ok: true, message: "No enabled SIEM integrations found.", results: [] as Record<string, unknown>[] };
  }

  const results: Record<string, unknown>[] = [];

  for (const integration of integrations) {
    try {
      await prisma.integration.update({ where: { id: integration.id }, data: { lastSyncStatus: "RUNNING" } });

      const result = await runIntegrationSync(integration);

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt:     new Date(),
          lastSyncStatus: "SUCCESS",
          lastSyncError:  result.errors.length > 0 ? result.errors.join("; ") : null,
          eventCount:     { increment: result.eventsIngested },
        },
      });

      results.push({
        id:             integration.id,
        name:           integration.name,
        type:           integration.type,
        eventsIngested: result.eventsIngested,
        warnings:       result.errors,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.integration
        .update({ where: { id: integration.id }, data: { lastSyncStatus: "ERROR", lastSyncError: msg } })
        .catch(() => {});
      results.push({ id: integration.id, name: integration.name, type: integration.type, error: msg });
    }
  }

  return { ok: true, results };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runAll());
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runAll());
}
