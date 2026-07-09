import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { testO365Connection } from "@/lib/integrations/o365";

export async function POST(request: Request) {
  await requireRole("ADMIN");

  const body = await request.json().catch(() => null);
  if (!body?.tenantId || !body?.clientId || !body?.clientSecret) {
    return NextResponse.json({ error: "tenantId, clientId and clientSecret are required" }, { status: 400 });
  }

  const error = await testO365Connection(body.tenantId, body.clientId, body.clientSecret);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
