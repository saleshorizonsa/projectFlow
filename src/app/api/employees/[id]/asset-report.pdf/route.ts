import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { buildEmployeeAssetPdf } from "@/lib/simple-pdf";
import { formatEnum } from "@/lib/utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  await requireRole("VIEWER");
  const { id } = await context.params;
  const employee = await getPrisma().employee.findUnique({
    where: { id },
    include: {
      companies: { include: { company: true } },
      assets: {
        include: { companies: { include: { company: true } } },
        orderBy: { assetTag: "asc" },
      },
      licenses: { include: { asset: true }, orderBy: { expiryDate: "asc" } },
    },
  });

  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const pdf = buildEmployeeAssetPdf({
    companyNames: employee.companies.map((link) => link.company.name),
    employeeId: employee.employeeId,
    name: employee.name,
    department: employee.department,
    jobTitle: employee.jobTitle,
    email: employee.email ?? "Not captured",
    phone: employee.phone ?? "Not captured",
    location: employee.location ?? "Not captured",
    status: formatEnum(employee.status),
    companyCodes: employee.companies.map((link) => link.company.code).join(", ") || "None",
    assets: employee.assets.map((a) => ({
      assetTag: a.assetTag,
      name: a.name,
      type: formatEnum(a.type),
      vendorModel: [a.vendor, a.model].filter(Boolean).join(" ").trim() || "-",
      status: formatEnum(a.status),
    })),
    licenses: employee.licenses.map((lic) => ({
      licenseId: lic.licenseId,
      name: lic.name,
      vendor: lic.vendor,
      expiry: lic.expiryDate.toLocaleDateString(),
    })),
    generatedAt: new Date().toLocaleString(),
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${employee.employeeId}-handover.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

