import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { buildSimplePdf } from "@/lib/simple-pdf";
import { formatEnum } from "@/lib/utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  await requireRole("VIEWER");
  const { id } = await context.params;
  const employee = await getPrisma().employee.findUnique({
    where: { id },
    include: {
      companies: { include: { company: true } },
      assets: { include: { companies: { include: { company: true } } }, orderBy: { assetTag: "asc" } },
      licenses: { include: { asset: true }, orderBy: { expiryDate: "asc" } },
    },
  });

  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const lines = [
    `Employee: ${employee.employeeId} / ${employee.name}`,
    `Department: ${employee.department}`,
    `Job Title: ${employee.jobTitle}`,
    `Email: ${employee.email ?? "Not captured"}`,
    `Phone: ${employee.phone ?? "Not captured"}`,
    `Companies: ${employee.companies.map((link) => link.company.code).join(", ") || "None"}`,
    "",
    "Assets Provided",
    ...employee.assets.map((asset) => `${asset.assetTag} - ${asset.name} (${formatEnum(asset.type)}) / ${asset.vendor} ${asset.model}`),
    ...(employee.assets.length ? [] : ["No assets assigned."]),
    "",
    "Licenses Assigned",
    ...employee.licenses.map((license) => `${license.licenseId} - ${license.name} / ${license.vendor} / expires ${license.expiryDate.toLocaleDateString()}`),
    ...(employee.licenses.length ? [] : ["No licenses assigned."]),
    "",
    "Employee Signature: __________________________",
    "IT Signature: ________________________________",
  ];
  const pdf = buildSimplePdf("Employee Asset & License Handover Record", lines);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${employee.employeeId}-asset-report.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
