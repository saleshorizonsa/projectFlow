import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { safeDecryptField } from "@/lib/encrypt";
import { logSecurityEventsBatch } from "@/lib/security-events";
import {
  WAZUH_MAX_BODY_BYTES,
  WAZUH_TYPE,
  extractBearer,
  mapWazuhAlertToEvent,
  mapWazuhVulnerability,
  normalizeWazuhConfig,
  parseWazuhPayload,
  tokensMatch,
  type WazuhVulnPayload,
} from "@/lib/integrations/wazuh";

// Public endpoint (see middleware PUBLIC_PREFIXES): the Wazuh manager pushes alerts here
// with "Authorization: Bearer <token>". The token is per-integration and stored encrypted.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prisma = getPrisma();

  const integration = await prisma.integration.findUnique({ where: { id } });
  const expected = integration?.type === WAZUH_TYPE ? safeDecryptField(integration.clientSecret) : null;
  const provided = extractBearer(request.headers.get("authorization"));
  if (!integration || !expected || !provided || !tokensMatch(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!integration.enabled) {
    return NextResponse.json({ error: "Integration is disabled in Masar" }, { status: 403 });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > WAZUH_MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const raw = await request.text();
  if (raw.length > WAZUH_MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { alerts, invalid, tooMany } = parseWazuhPayload(body);
  if (tooMany) return NextResponse.json({ error: "Too many alerts in one request" }, { status: 413 });

  const config = normalizeWazuhConfig(integration.config);

  // Vulnerability-detector alerts always go to Vulnerability Management (when enabled),
  // even below minLevel, so "solved" notices can close findings.
  const vulnPayloads: WazuhVulnPayload[] = [];
  if (config.importVulnerabilities) {
    for (const alert of alerts) {
      const payload = mapWazuhVulnerability(alert);
      if (payload) vulnPayloads.push(payload);
    }
  }

  const candidates = alerts
    .filter((alert) => alert.rule.level >= config.minLevel)
    .map((alert) => mapWazuhAlertToEvent(alert, integration.id));

  // Skip alerts already stored (e.g. a vulnerability alert matched by both ossec.conf blocks).
  const alertIds = [...new Set(candidates.map((e) => e.metadata?.alertId).filter((v): v is string => typeof v === "string"))];
  const seen = new Set<string>();
  if (alertIds.length > 0) {
    const existing = await prisma.securityEvent.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
        OR: alertIds.map((alertId) => ({ metadata: { path: ["alertId"], equals: alertId } })),
      },
      select: { metadata: true },
    });
    for (const row of existing) {
      const alertId = (row.metadata as { alertId?: unknown } | null)?.alertId;
      if (typeof alertId === "string") seen.add(alertId);
    }
  }
  const events = candidates.filter((e) => {
    const alertId = e.metadata?.alertId;
    if (typeof alertId !== "string") return true;
    if (seen.has(alertId)) return false;
    seen.add(alertId);
    return true;
  });
  const skipped = alerts.length - events.length;

  const written = await logSecurityEventsBatch(events);
  const vulns = await upsertVulnerabilities(vulnPayloads);

  const failed = events.length > 0 && written === 0;
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: failed ? "ERROR" : "SUCCESS",
      lastSyncError: failed ? "Alerts were received but could not be saved." : null,
      eventCount: { increment: written },
    },
  });

  if (failed) return NextResponse.json({ error: "Could not save alerts" }, { status: 500 });
  return NextResponse.json({ ok: true, received: alerts.length, invalid, events: written, skipped, vulnerabilities: vulns });
}

async function upsertVulnerabilities(payloads: WazuhVulnPayload[]) {
  const result = { created: 0, updated: 0, closed: 0 };
  if (payloads.length === 0) return result;
  const prisma = getPrisma();

  // Link to an IT asset whose name matches the Wazuh agent name (case-insensitive).
  const agentNames = [...new Set(payloads.map((p) => p.agentName))];
  const assets = await prisma.iTAsset.findMany({
    where: { OR: agentNames.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) },
    select: { id: true, name: true },
  });
  const assetByName = new Map(assets.map((asset) => [asset.name.toLowerCase(), asset.id]));

  for (const p of payloads) {
    try {
      const existing = await prisma.vulnerability.findUnique({ where: { vulnId: p.vulnId }, select: { id: true, status: true } });
      if (p.solved) {
        if (existing && existing.status !== "REMEDIATED") {
          await prisma.vulnerability.update({
            where: { id: existing.id },
            data: { status: "REMEDIATED", closedAt: new Date(), updatedBy: "wazuh" },
          });
          result.closed++;
        }
        continue;
      }
      const fields = {
        title: p.title,
        cveId: p.cveId,
        description: p.description,
        severity: p.severity,
        cvssScore: p.cvssScore,
        affectedComponent: p.affectedComponent,
        remediation: p.remediation,
        assetId: assetByName.get(p.agentName.toLowerCase()) ?? null,
      };
      if (existing) {
        // Re-detected: refresh details; reopen only if it had been marked remediated.
        await prisma.vulnerability.update({
          where: { id: existing.id },
          data: { ...fields, ...(existing.status === "REMEDIATED" ? { status: "OPEN", closedAt: null } : {}), updatedBy: "wazuh" },
        });
        result.updated++;
      } else {
        await prisma.vulnerability.create({
          data: { ...fields, vulnId: p.vulnId, source: "wazuh", status: "OPEN", discoveredAt: new Date(), createdBy: "wazuh" },
        });
        result.created++;
      }
    } catch {
      // One bad finding must not block the rest.
    }
  }
  return result;
}
