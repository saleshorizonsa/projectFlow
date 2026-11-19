import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

// SACS-210 controls each SIEM integration directly provides evidence for. This attaches
// the SIEM as *evidence* (with live stats) — it deliberately does NOT set control
// status, since the system self-certifying compliance is what auditors reject.
const SIEM_SOURCES: Record<string, { label: string; controls: string[] }> = {
  O365: { label: "Microsoft 365 SIEM", controls: ["SO-01", "ALM-01", "SO-05", "ALM-03"] },
  // Wazuh also covers vulnerability detection (VM-01) and CIS hardening checks via SCA (VM-04).
  WAZUH: { label: "Wazuh SIEM", controls: ["SO-01", "ALM-01", "SO-05", "ALM-03", "VM-01", "VM-04"] },
};

export async function POST() {
  const session = await requireRole("PROJECT_MANAGER");
  const prisma = getPrisma();

  const allControlIds = [...new Set(Object.values(SIEM_SOURCES).flatMap((s) => s.controls))];
  const framework = await prisma.complianceFramework.findFirst({
    where: { code: "SACS-210" },
    include: {
      domains: {
        include: {
          controls: {
            where: { controlId: { in: allControlIds } },
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
    where: { type: { in: Object.keys(SIEM_SOURCES) }, enabled: true, lastSyncStatus: "SUCCESS" },
  });
  if (integrations.length === 0) {
    return NextResponse.json({
      ok: true, linked: 0, updated: 0, controls: [],
      message: "No working SIEM integration found to link. Connect Microsoft 365 or Wazuh under Settings → Integrations and make sure it has received data.",
    });
  }

  let linked = 0;
  let updated = 0;
  const touched = new Set<string>();

  for (const integ of integrations) {
    const source = SIEM_SOURCES[integ.type];
    const fileName = `${source.label} - ${integ.name}`;
    const lastSync = integ.lastSyncAt ? integ.lastSyncAt.toISOString() : "n/a";
    let notes: string;
    if (integ.type === "WAZUH") {
      notes =
        `[auto:siem:${integ.id}] Live Wazuh alert forwarding active (on-prem manager → Masar). ` +
        `Events received: ${integ.eventCount}. Last alert: ${lastSync}. ` +
        `Covers agent log collection, detection rules with MITRE ATT&CK mapping, vulnerability detection and SCA (CIS) checks. ` +
        `Attach Wazuh dashboard reports (agents, vulnerabilities, SCA) for full evidence. Auto-generated evidence — verify status manually before audit.`;
    } else {
      const config = (integ.config ?? {}) as { contentTypes?: string[] };
      notes =
        `[auto:siem:${integ.id}] Live O365 audit-log ingestion active. ` +
        `Log sources: ${config.contentTypes?.length ?? 0}. Events ingested: ${integ.eventCount}. ` +
        `Last sync: ${lastSync}. ` +
        `MITRE ATT&CK tactic tagging enabled. Auto-generated evidence — verify status manually before audit.`;
    }

    for (const control of controls.filter((c) => source.controls.includes(c.controlId))) {
      touched.add(control.controlId);
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
    controls: [...touched].sort(),
    sources: [...new Set(integrations.map((i) => SIEM_SOURCES[i.type].label))],
    integrations: integrations.length,
  });
}
