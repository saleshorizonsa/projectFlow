import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { itLicenseSchema } from "@/lib/validators";
import { Prisma } from "@prisma/client";

export async function GET() {
  await requireRole("VIEWER");
  const licenses = await getPrisma().iTLicense.findMany({
    select: { id: true, licenseId: true, name: true, vendor: true, assetId: true, expiryDate: true, _count: { select: { assignments: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(licenses);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");
  const parsed = itLicenseSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid license data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { assetId, ...payload } = parsed.data;
  try {
    const license = await getPrisma().iTLicense.create({
      data: {
        ...payload,
        assetId: assetId || null,
        createdBy: session.user.id,
      },
    });
    return NextResponse.json(license, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "License ID already exists. Use a unique License ID." }, { status: 409 });
    }
    return NextResponse.json({ error: "License could not be saved. Please try again." }, { status: 500 });
  }
}
