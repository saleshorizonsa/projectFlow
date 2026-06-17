import { NextResponse } from "next/server";
import { runAutomationEngine } from "@/lib/automation-engine";
import { requireRole } from "@/lib/permissions";

export async function POST() {
  await requireRole("PROJECT_MANAGER");
  const results = await runAutomationEngine();
  return NextResponse.json({ ok: true, results });
}
