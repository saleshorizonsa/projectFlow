import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { encryptField } from "@/lib/encrypt";

const SAFE_SELECT = {
  id: true, type: true, name: true, enabled: true,
  tenantId: true, clientId: true,
  config: true, lastSyncAt: true, lastSyncStatus: true,
  lastSyncError: true, eventCount: true, createdAt: true, updatedAt: true,
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const integration = await getPrisma().integration.findUnique({ where: { id }, select: SAFE_SELECT });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(integration);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("ADMIN");
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.name        !== undefined) data.name        = body.name;
  if (body.enabled     !== undefined) data.enabled     = body.enabled;
  if (body.tenantId    !== undefined) data.tenantId    = body.tenantId;
  if (body.clientId    !== undefined) data.clientId    = body.clientId;
  if (body.config      !== undefined) data.config      = body.config;
  if (body.clientSecret !== undefined && body.clientSecret !== "") {
    data.clientSecret = encryptField(body.clientSecret);
  }
  // Allow sync status resets
  if (body.lastSyncStatus !== undefined) data.lastSyncStatus = body.lastSyncStatus;
  if (body.lastSyncAt     !== undefined) data.lastSyncAt     = body.lastSyncAt;
  if (body.lastSyncError  !== undefined) data.lastSyncError  = body.lastSyncError;
  if (body.eventCount     !== undefined) data.eventCount     = body.eventCount;

  const integration = await getPrisma().integration.update({
    where: { id },
    data,
    select: SAFE_SELECT,
  });
  return NextResponse.json(integration);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("ADMIN");
  const { id } = await params;
  await getPrisma().integration.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
