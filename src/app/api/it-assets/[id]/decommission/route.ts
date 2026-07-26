import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { assetDecommissionSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  const prisma = getPrisma();

  const parsed = assetDecommissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decommission data", details: parsed.error.flatten() }, { status: 400 });
  }

  const asset = await prisma.iTAsset.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const d = parsed.data;

  const [updated] = await prisma.$transaction([
    prisma.iTAsset.update({
      where: { id },
      data: {
        status: "RETIRED",
        disposalDate: d.disposalDate,
        disposalMethod: d.disposalMethod,
        sanitizationMethod: d.sanitizationMethod,
        sanitizationStatus: d.sanitizationStatus,
        disposalCertificate: d.disposalCertificate ?? null,
        decommissionedBy: d.decommissionedBy ?? null,
        disposalNotes: d.disposalNotes ?? null,
        updatedBy: session.user.id,
      },
    }),
    prisma.assetLifecycleEvent.create({
      data: {
        assetId: id,
        fromStatus: asset.status,
        toStatus: "RETIRED",
        note: `Decommissioned — ${d.disposalMethod.replaceAll("_", " ").toLowerCase()}, sanitization ${d.sanitizationMethod} (${d.sanitizationStatus})`,
        createdBy: session.user.id,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, asset: updated });
}
