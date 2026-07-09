import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { encryptField } from "@/lib/encrypt";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integrations = await getPrisma().integration.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, name: true, enabled: true,
      tenantId: true, clientId: true,
      clientSecret: false, // never return secret
      config: true, lastSyncAt: true, lastSyncStatus: true,
      lastSyncError: true, eventCount: true, createdAt: true, updatedAt: true,
    },
  });
  return NextResponse.json(integrations);
}

export async function POST(request: Request) {
  await requireRole("ADMIN");

  const body = await request.json().catch(() => null);
  if (!body?.type || !body?.name) {
    return NextResponse.json({ error: "type and name are required" }, { status: 400 });
  }

  const clientSecret = body.clientSecret
    ? encryptField(body.clientSecret)
    : undefined;

  const integration = await getPrisma().integration.create({
    data: {
      type:         body.type,
      name:         body.name,
      enabled:      body.enabled ?? true,
      tenantId:     body.tenantId    ?? null,
      clientId:     body.clientId    ?? null,
      clientSecret: clientSecret     ?? null,
      config:       body.config      ?? null,
    },
    select: {
      id: true, type: true, name: true, enabled: true,
      tenantId: true, clientId: true, config: true,
      lastSyncAt: true, lastSyncStatus: true, lastSyncError: true,
      eventCount: true, createdAt: true, updatedAt: true,
    },
  });

  return NextResponse.json(integration, { status: 201 });
}
