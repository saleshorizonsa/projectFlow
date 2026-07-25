import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { runIntegrationSync } from "@/lib/integrations/sync";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("PROJECT_MANAGER");
  const { id } = await params;

  const integration = await getPrisma().integration.findUnique({ where: { id } });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!integration.enabled) return NextResponse.json({ error: "Integration is disabled" }, { status: 400 });

  // Mark as running
  await getPrisma().integration.update({
    where: { id },
    data: { lastSyncStatus: "RUNNING", lastSyncError: null },
  });

  try {
    const result = await runIntegrationSync(integration);

    await getPrisma().integration.update({
      where: { id },
      data: {
        lastSyncAt:     new Date(),
        lastSyncStatus: "SUCCESS",
        lastSyncError:  result.errors.length > 0 ? result.errors.join("; ") : null,
        eventCount:     { increment: result.eventsIngested },
      },
    });

    return NextResponse.json({
      ok: true,
      eventsIngested:     result.eventsIngested,
      contentUrisFetched: result.contentUrisFetched,
      warnings:           result.errors,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await getPrisma().integration.update({
      where: { id },
      data: { lastSyncStatus: "ERROR", lastSyncError: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("PROJECT_MANAGER");
  const { id } = await params;
  const integration = await getPrisma().integration.findUnique({
    where: { id },
    select: { lastSyncAt: true, lastSyncStatus: true, lastSyncError: true, eventCount: true },
  });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(integration);
}
