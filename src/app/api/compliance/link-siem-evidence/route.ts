import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

// SACS-210 controls the O365 SIEM directly provides evidence for. This attaches
// the SIEM as *evidence* (with live sync stats) — it deliberately does NOT set
// control status, since the system self-certifying compliance is what auditors reject.
const TARGET_CONTROLS = ["SO-01", "ALM-01", "SO-05", "ALM-03"];

export async function POST() {
  const session = await requireRole("PROJECT_MANAGER");
  const prisma = getPrisma();

  const framework = await prisma.complianceFramework.findFirst({
    where: { code: "SACS-210" },
    include: {
      domains: {
        include: {
          controls: {
            where: { controlId: { in: TARGET_CONTROLS } },
            select: { id: true, controlId: true },
          },
        },
      },
    },
  });
  if (!framework) return NextResponse.json({ error: "SACS-210 framework not found" }, { status: 404 });

  const controls = framework.domains.flatMap((d) => d.controls);
  if (controls.length === 0) return NextResponse.json({ error: "Target controls not found in framework" }, { status: 404 });

  const integrations = await prisma.integration.findMany({
    where: { type: "O365", enabled: true, lastSyncStatus: "SUCCESS" },
  });
  if (integrations.length === 0) {
    return NextResponse.json({ ok: true, linked: 0, updated: 0, message: "No successfully-synced Microsoft 365 SIEM integration found to link." });
  }

  let linked = 0;
  let updated = 0;

  for (const integ of integrations) {
    const config = (integ.config ?? {}) as { contentTypes?: string[] };
    const sources = config.contentTypes?.length ?? 0;
    const fileName = `Microsoft 365 SIEM - ${integ.name}`;
    const notes =
      `[auto:siem:${integ.id}] Live O365 audit-log ingestion active. ` +
      `Log sources: ${sources}. Events ingested: ${integ.eventCount}. ` +
      `Last sync: ${integ.lastSyncAt ? integ.lastSyncAt.toISOString() : "n/a"}. ` +
      `MITRE ATT&CK tactic tagging enabled. Auto-generated evidence — verify status manually before audit.`;

    for (const control of controls) {
      const existing = await prisma.controlEvidence.findFirst({
        where: { controlId: control.id, fileName },
        select: { id: true },
      });
      if (existing) {
        await prisma.controlEvidence.update({ where: { id: existing.id }, data: { notes, updatedBy: session.user.id } });
        updated++;
      } else {
        await prisma.controlEvidence.create({
          data: {
            controlId: control.id,
            fileName,
            fileUrl: "/integrations",
            notes,
            uploadedById: session.user.id,
            createdBy: session.user.id,
          },
        });
        linked++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    linked,
    updated,
    controls: controls.map((c) => c.controlId),
    integrations: integrations.length,
  });
}
