/**
 * Sophos Central SIEM integration.
 *
 * Docs: https://developer.sophos.com/docs/siem-v1/1/overview
 *
 * Auth: Sophos Central API credentials (client_id + client_secret) — App-only.
 * Flow: client_credentials -> token -> whoami (resolve tenantId + regional data host)
 *       -> GET {dataRegion}/siem/v1/events (paginate via cursor) -> map -> logSecurityEvent.
 */

import { logSecurityEvent, type SecurityEventInput } from "@/lib/security-events";

const TOKEN_URL = "https://id.sophos.com/api/v2/oauth2/token";
const WHOAMI_URL = "https://api.central.sophos.com/whoami/v1";

export type SophosConfig = {
  minSeverity?: "low" | "medium" | "high";
};

// ── OAuth2 token ──────────────────────────────────────────────────────────────

export async function getSophosToken(clientId: string, clientSecret: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         "token",
  });
  const res = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Sophos token error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("Sophos: no access_token in response");
  return data.access_token as string;
}

// ── Whoami: resolve tenant + regional data host ───────────────────────────────

type Whoami = { tenantId: string; dataRegion: string };

export async function getSophosWhoami(token: string): Promise<Whoami> {
  const res = await fetch(WHOAMI_URL, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Sophos whoami error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const tenantId = data.id as string | undefined;
  const dataRegion = data.apiHosts?.dataRegion as string | undefined;
  if (!tenantId || !dataRegion) {
    throw new Error("Sophos whoami: missing tenant id or data region (use tenant-level API credentials, not partner/organization)");
  }
  return { tenantId, dataRegion };
}

/** Quick credentials test — returns null on success, error message on failure. */
export async function testSophosConnection(clientId: string, clientSecret: string): Promise<string | null> {
  try {
    const token = await getSophosToken(clientId, clientSecret);
    await getSophosWhoami(token);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Unknown error";
  }
}

// ── Event mapping ─────────────────────────────────────────────────────────────

type SophosEvent = {
  id?: string;
  type?: string;
  group?: string;
  name?: string;
  severity?: string;
  when?: string;
  created_at?: string;
  source?: string;
  source_info?: { ip?: string };
  location?: string;
  endpoint_id?: string;
  endpoint_type?: string;
};

const SEV_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };

function mapSeverity(s?: string): string {
  switch ((s ?? "").toLowerCase()) {
    case "high": return "HIGH";
    case "medium": return "MEDIUM";
    case "low": return "LOW";
    default: return "INFO";
  }
}

/**
 * Sophos publishes hundreds of event types; we classify by keyword rather than
 * enumerate. Full original type/group is preserved in metadata for the analyst.
 */
function mapType(evt: SophosEvent): string {
  const t = `${evt.type ?? ""} ${evt.group ?? ""}`.toLowerCase();
  if (/(threat|malware|ransom|exploit|cve|pua|virus|runtime|tamper|detection)/.test(t)) return "SUSPICIOUS_ACTIVITY";
  if (/(login|logon|authentication|\bauth\b)/.test(t)) return /(fail|denied|invalid|lock)/.test(t) ? "LOGIN_FAILURE" : "LOGIN_SUCCESS";
  if (/policy/.test(t)) return "POLICY_CHANGED";
  if (/(web|application|control|device|peripheral|dlp|\bdata\b|update|install|protection)/.test(t)) return "CONFIG_CHANGED";
  const sev = mapSeverity(evt.severity);
  return sev === "HIGH" || sev === "MEDIUM" ? "SUSPICIOUS_ACTIVITY" : "CONFIG_CHANGED";
}

function mapRecord(evt: SophosEvent): SecurityEventInput {
  const host = evt.location ?? "";
  const ip = evt.source_info?.ip;
  const actor = evt.source ?? ip ?? "";
  return {
    type:        mapType(evt),
    severity:    mapSeverity(evt.severity),
    actor:       actor || undefined,
    actorIp:     ip || undefined,
    resource:    host ? `Sophos/${host}` : "Sophos",
    resourceId:  String(evt.endpoint_id ?? evt.id ?? ""),
    description: `[Sophos] ${evt.name ?? evt.type ?? "event"}${host ? ` on ${host}` : ""}`,
    metadata: {
      source:       "sophos",
      sophosType:   evt.type,
      group:        evt.group,
      endpointType: evt.endpoint_type,
      when:         evt.when ?? evt.created_at,
      eventId:      evt.id,
    },
  };
}

// ── Main sync function ────────────────────────────────────────────────────────

export type SyncResult = {
  eventsIngested: number;
  contentUrisFetched: number;
  errors: string[];
};

export async function syncSophos(
  clientId:     string,
  clientSecret: string,
  config:       SophosConfig,
  lastSyncAt:   Date | null,
): Promise<SyncResult> {
  const result: SyncResult = { eventsIngested: 0, contentUrisFetched: 0, errors: [] };

  const token = await getSophosToken(clientId, clientSecret);
  const { tenantId, dataRegion } = await getSophosWhoami(token);

  // Sophos SIEM events endpoint only serves the trailing 24 h.
  const now = Date.now();
  const maxLookbackMs = 24 * 3_600_000;
  const fromMs = lastSyncAt ? Math.max(lastSyncAt.getTime(), now - maxLookbackMs) : now - maxLookbackMs;
  const fromDate = Math.floor(fromMs / 1000);

  const minSeverity = config.minSeverity;
  const headers = { Authorization: `Bearer ${token}`, "X-Tenant-ID": tenantId, Accept: "application/json" };

  let url: string = `${dataRegion}/siem/v1/events?limit=1000&from_date=${fromDate}`;
  let guard = 0;

  while (url && guard < 50) {
    guard++;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Sophos events error ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json().catch(() => ({ items: [] as SophosEvent[] }));
    const items: SophosEvent[] = Array.isArray(data.items) ? data.items : [];
    result.contentUrisFetched += items.length;

    for (const evt of items) {
      if (minSeverity && (SEV_RANK[(evt.severity ?? "low").toLowerCase()] ?? 1) < SEV_RANK[minSeverity]) continue;
      try {
        await logSecurityEvent(mapRecord(evt));
        result.eventsIngested++;
      } catch (e) {
        result.errors.push(`map event: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (data.has_more && data.next_cursor) {
      url = `${dataRegion}/siem/v1/events?limit=1000&cursor=${encodeURIComponent(String(data.next_cursor))}`;
    } else {
      url = "";
    }
  }

  return result;
}
