import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { employeeUpdateSchema } from "@/lib/validators";
import { encryptField } from "@/lib/encrypt";

type RouteContext = { params: Promise<{ id: string }> };

function nullIfEmpty(v: string | null | undefined): string | null | undefined {
  if (v === "") return null;
  return v;
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = employeeUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { companyIds, email, phone, location, ipAddress, vpnUserId, vpnPassword, ...payload } = parsed.data;

  if (companyIds !== undefined) {
    if (companyIds.length === 0) {
      return NextResponse.json({ error: "At least one company must be selected." }, { status: 400 });
    }
    const found = await getPrisma().company.findMany({ where: { id: { in: companyIds }, active: true } });
    if (found.length !== companyIds.length) {
      return NextResponse.json({ error: "One or more selected companies are unavailable." }, { status: 400 });
    }
  }

  try {
    const employee = await getPrisma().employee.update({
      where: { id },
      data: {
        ...payload,
        ...(email !== undefined ? { email: email === "" ? null : email } : {}),
        ...(phone !== undefined ? { phone: nullIfEmpty(phone) } : {}),
        ...(location !== undefined ? { location: nullIfEmpty(location) } : {}),
        ...(ipAddress !== undefined ? { ipAddress: nullIfEmpty(ipAddress) } : {}),
        ...(vpnUserId !== undefined ? { vpnUserId: nullIfEmpty(vpnUserId) } : {}),
        ...(vpnPassword !== undefined && process.env.ENCRYPTION_KEY ? { vpnPassword: vpnPassword === "" ? null : encryptField(vpnPassword) } : {}),
        updatedBy: session.user.id,
        ...(companyIds ? {
          companies: {
            deleteMany: {},
            create: companyIds.map((companyId) => ({ companyId, createdBy: session.user.id })),
          },
        } : {}),
      },
      include: { companies: { include: { company: true } }, assets: true, licenses: true },
    });

    return NextResponse.json(employee);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }
    if (code === "P2002") {
      const field = ((err as { meta?: { target?: string[] } }).meta?.target ?? []).join(", ");
      return NextResponse.json(
        { error: `Duplicate value: ${field || "employeeId"} already exists.` },
        { status: 409 },
      );
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("ENCRYPTION_KEY")) {
      return NextResponse.json(
        { error: "VPN password encryption is not configured on this server. Leave the VPN Password field blank to save other changes." },
        { status: 500 },
      );
    }
    console.error("Employee PATCH error:", err);
    return NextResponse.json({ error: "Failed to update employee. Please try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;
  await getPrisma().$transaction([
    getPrisma().iTAsset.updateMany({ where: { employeeId: id }, data: { employeeId: null } }),
    getPrisma().iTLicense.updateMany({ where: { employeeId: id }, data: { employeeId: null } }),
    getPrisma().employee.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
