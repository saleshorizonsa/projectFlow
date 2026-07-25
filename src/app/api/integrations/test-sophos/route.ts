import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { testSophosConnection } from "@/lib/integrations/sophos";

export async function POST(request: Request) {
  await requireRole("ADMIN");

  const body = await request.json().catch(() => null);
  if (!body?.clientId || !body?.clientSecret) {
    return NextResponse.json({ error: "clientId and clientSecret are required" }, { status: 400 });
  }

  const error = await testSophosConnection(body.clientId, body.clientSecret);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
