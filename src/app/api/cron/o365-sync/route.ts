// Scheduled sync endpoint — call every 15 min via Vercel Cron or external scheduler.
// Header: x-cron-secret: <CRON_SECRET env var>

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { decryptField } from "@/lib/encrypt";
import { syncO365, type O365Config } from "@/lib/integrations/o365";

export async function POST(request: Request) {
  // Protect with a shared secret (set CRON_SECRET in your environment)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const incoming = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
    if (incoming !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const integrations = await getPrisma().integration.findMany({
    where: { type: "O365", enabled: true },
  });

  if (integrations.length === 0) {
    return NextResponse.json({ ok: true, message: "No enabled O365 integrations found." });
  }

  const results: Record<string, unknown>[] = [];

  for (const integration of integrations) {
    if (!integration.tenantId || !integration.clientId || !integration.clientSecret) {
      results.push({ id: integration.id, name: integration.name, skipped: "missing credentials" });
      continue;
    }

    try {
      await getPrisma().integration.update({
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

      await getPrisma().integration.update({
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
      await getPrisma().integration.update({
        where: { id: integration.id },
        data:  { lastSyncStatus: "ERROR", lastSyncError: msg },
      }).catch(() => {});
      results.push({ id: integration.id, name: integration.name, error: msg });
    }
  }

  return NextResponse.json({ ok: true, results });
}

// Also support GET for simple health-check pings
export async function GET() {
  const count = await getPrisma().integration.count({ where: { type: "O365", enabled: true } });
  return NextResponse.json({ ok: true, enabledO365Integrations: count });
}
