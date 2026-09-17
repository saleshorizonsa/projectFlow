import { NextResponse } from "next/server";
import { runAutomationEngine } from "@/lib/automation-engine";

// Runs daily via Vercel Cron (see vercel.json), which sends "Authorization: Bearer <CRON_SECRET>".
// External schedulers can use AUTOMATION_SECRET as ?token= or a Bearer header.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secrets = [process.env.AUTOMATION_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (secrets.length > 0) {
    const token = new URL(request.url).searchParams.get("token");
    const authorization = request.headers.get("authorization");
    const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
    if (!secrets.includes(token ?? undefined) && !secrets.includes(bearer ?? undefined)) {
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
