import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { buildReportCsv, isReportType, reportFileName } from "@/lib/reports";

type RouteContext = { params: Promise<{ type: string }> };

export async function GET(_request: Request, context: RouteContext) {
  await requireRole("VIEWER");
  const { type } = await context.params;
  const companyId = new URL(_request.url).searchParams.get("company") ?? undefined;

  if (!isReportType(type)) {
    return NextResponse.json({ error: "Report type not found" }, { status: 404 });
  }

  const csv = await buildReportCsv(type, companyId);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reportFileName(type)}"`,
      "Cache-Control": "no-store",
    },
  });
}
