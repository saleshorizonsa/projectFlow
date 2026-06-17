import { NextResponse } from "next/server";
import { runAutomationEngine } from "@/lib/automation-engine";

export async function GET(request: Request) {
  const secret = process.env.AUTOMATION_SECRET;
  if (secret) {
    const token = new URL(request.url).searchParams.get("token");
    const authorization = request.headers.get("authorization");
    const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
    if (token !== secret && bearer !== secret) {
      return NextResponse.json({ error: "Unauthorized automation request." }, { status: 401 });
    }
  }

  const results = await runAutomationEngine();
  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    results,
  });
}
