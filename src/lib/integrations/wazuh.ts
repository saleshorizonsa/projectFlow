/**
 * Wazuh SIEM integration (push model).
 *
 * The Wazuh manager is on-prem and is never exposed to the internet. Instead, the
 * manager's integratord runs `integrations/wazuh/custom-masar.py`, which POSTs each
 * matching alert (JSON) to POST /api/integrations/wazuh/<integrationId>/alerts with
 * "Authorization: Bearer <token>".
 *
 * This module is PURE (no DB / no Prisma runtime imports) so the mapping logic can be
 * exercised with sample alerts from a plain tsx script.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import type { SecurityEventInput } from "@/lib/security-events";

export const WAZUH_TYPE = "WAZUH";

/** Max alerts accepted in one request (integratord sends one; arrays are for batch forwarders). */
export const WAZUH_MAX_ALERTS = 500;
/** Max request body size in bytes. */
export const WAZUH_MAX_BODY_BYTES = 5 * 1024 * 1024;

export type WazuhConfig = {
  minLevel: number;
  importVulnerabilities: boolean;
};

export const WAZUH_DEFAULT_CONFIG: WazuhConfig = { minLevel: 7, importVulnerabilities: true };

export function normalizeWazuhConfig(raw: unknown): WazuhConfig {
  const cfg = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof WazuhConfig, unknown>>;
  const lvl = Number(cfg.minLevel);
  return {
    minLevel: Number.isFinite(lvl) ? Math.min(16, Math.max(0, Math.round(lvl))) : WAZUH_DEFAULT_CONFIG.minLevel,
    importVulnerabilities:
      typeof cfg.importVulnerabilities === "boolean" ? cfg.importVulnerabilities : WAZUH_DEFAULT_CONFIG.importVulnerabilities,
  };
}

// ── Token helpers ─────────────────────────────────────────────────────────────

export function generateWazuhToken(): string {
  return randomBytes(32).toString("hex");
}

/** Constant-time comparison (hash first so differing lengths don't leak via timing). */
export function tokensMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b) && provided.length === expected.length;
}

export function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

// ── Alert schema (lenient) ────────────────────────────────────────────────────

const str = z.union([z.string(), z.number()]).transform((v) => String(v));
const strArr = z
  .union([z.array(z.union([z.string(), z.number()])), z.string()])
  .transform((v) => (Array.isArray(v) ? v.map(String) : [v]));

export const wazuhAlertSchema = z
  .object({
    id: str.optional(),
    timestamp: z.string().optional(),
    full_log: z.string().optional(),
    location: z.string().optional(),
    rule: z
      .object({
        level: z.coerce.number().int().min(0).max(16),
        id: str.optional(),
        description: z.string().optional(),
        groups: strArr.optional(),
        mitre: z
          .object({
            tactic: strArr.optional(),
            technique: strArr.optional(),
            id: strArr.optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
    agent: z
      .object({
        id: str.optional(),
        name: z.string().optional(),
        ip: z.string().optional(),
      })
      .passthrough()
      .optional(),
    manager: z.object({ name: z.string().optional() }).passthrough().optional(),
    data: z.record(z.unknown()).optional(),
  })
  .passthrough();

export type WazuhAlert = z.infer<typeof wazuhAlertSchema>;

/** Accepts one alert or an array. Invalid items are reported, not fatal. */
export function parseWazuhPayload(body: unknown): { alerts: WazuhAlert[]; invalid: number; tooMany: boolean } {
  const items = Array.isArray(body) ? body : [body];
  if (items.length > WAZUH_MAX_ALERTS) return { alerts: [], invalid: 0, tooMany: true };
  const alerts: WazuhAlert[] = [];
  let invalid = 0;
  for (const item of items) {
    const parsed = wazuhAlertSchema.safeParse(item);
    if (parsed.success) alerts.push(parsed.data);
    else invalid++;
  }
  return { alerts, invalid, tooMany: false };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function get(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function getStr(obj: unknown, ...paths: string[][]): string | undefined {
  for (const p of paths) {
    const v = get(obj, p);
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s && s !== "-" && s !== "(null)" && s.toLowerCase() !== "n/a") return s;
  }
  return undefined;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ── Severity / type mapping ───────────────────────────────────────────────────

export type SecuritySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Wazuh rule level (0–16) → SecurityEventSeverity. */
export function mapWazuhLevel(level: number): SecuritySeverity {
  if (level >= 13) return "CRITICAL";
  if (level >= 10) return "HIGH";
  if (level >= 7) return "MEDIUM";
  if (level >= 4) return "LOW";
  return "INFO";
}

// Ordered: first matching group wins. Values must be existing SecurityEventType enum members.
const GROUP_TYPE_RULES: { groups: string[]; type: string; tactic?: string }[] = [
  { groups: ["vulnerability-detector"], type: "VULNERABILITY_OPENED" },
  { groups: ["account_locked", "account_lockout"], type: "LOGIN_LOCKOUT", tactic: "Credential Access" },
  { groups: ["authentication_failures", "authentication_failed", "invalid_login", "win_authentication_failed", "login_denied"], type: "LOGIN_FAILURE", tactic: "Credential Access" },
  { groups: ["authentication_success"], type: "LOGIN_SUCCESS", tactic: "Initial Access" },
  { groups: ["adduser", "account_created"], type: "USER_CREATED", tactic: "Persistence" },
  { groups: ["userdel", "account_deleted", "groupdel"], type: "USER_DELETED", tactic: "Impact" },
  { groups: ["password_changed", "passwd"], type: "PASSWORD_CHANGED" },
  { groups: ["group_changed", "sudo", "su", "privilege_escalation"], type: "ROLE_CHANGED", tactic: "Privilege Escalation" },
  { groups: ["policy_changed", "audit_policy_changed"], type: "POLICY_CHANGED", tactic: "Defense Evasion" },
  {
    groups: [
      "malware", "virus", "virustotal", "rootcheck", "ids", "attack", "attacks", "exploit_attempt", "web_scan", "recon",
      "sql_injection", "xss", "web", "accesslog", "invalid_access", "multiple_drops", "firewall_drop", "yara", "osquery",
      "suricata", "threat_intel", "brute_force",
    ],
    type: "SUSPICIOUS_ACTIVITY",
  },
  { groups: ["syscheck", "syscheck_file", "syscheck_entry_modified", "syscheck_entry_added", "syscheck_entry_deleted", "syscheck_registry", "sca", "config_changed"], type: "CONFIG_CHANGED" },
];

/** No generic "other" member exists in SecurityEventType; SUSPICIOUS_ACTIVITY is the closest catch-all. */
const FALLBACK_TYPE = "SUSPICIOUS_ACTIVITY";

export function mapWazuhGroups(groups: string[]): { type: string; tactic?: string } {
  const set = new Set(groups.map((g) => g.toLowerCase()));
  for (const r of GROUP_TYPE_RULES) {
    if (r.groups.some((g) => set.has(g))) return { type: r.type, tactic: r.tactic };
  }
  return { type: FALLBACK_TYPE };
}

// ── Alert → SecurityEvent ─────────────────────────────────────────────────────

export function isVulnerabilityAlert(alert: WazuhAlert): boolean {
  const groups = (alert.rule.groups ?? []).map((g) => g.toLowerCase());
  return groups.includes("vulnerability-detector") && !!get(alert.data, ["vulnerability"]);
}

export function mapWazuhAlertToEvent(alert: WazuhAlert, integrationId?: string): SecurityEventInput {
  const level = alert.rule.level;
  const groups = alert.rule.groups ?? [];
  const { type, tactic } = mapWazuhGroups(groups);
  const agentName = alert.agent?.name ?? alert.manager?.name ?? "unknown-agent";
  const ruleDesc = alert.rule.description ?? `Wazuh rule ${alert.rule.id ?? "?"}`;

  const actor = getStr(
    alert.data,
    ["srcuser"], ["dstuser"], ["user"],
    ["win", "eventdata", "targetUserName"], ["win", "eventdata", "subjectUserName"],
    ["audit", "auid"],
  );
  const actorIp = getStr(alert.data, ["srcip"], ["win", "eventdata", "ipAddress"], ["src_ip"]);

  const mitre = alert.rule.mitre
    ? { tactic: alert.rule.mitre.tactic ?? [], technique: alert.rule.mitre.technique ?? [], id: alert.rule.mitre.id ?? [] }
    : undefined;

  return {
    type,
    severity: mapWazuhLevel(level),
    actor,
    actorIp,
    resource: agentName,
    resourceId: alert.agent?.id,
    description: truncate(`[Wazuh] ${ruleDesc} — ${agentName}`, 1000),
    mitreTactic: mitre?.tactic[0] ?? tactic,
    metadata: {
      source: "wazuh",
      integrationId,
      alertId: alert.id,
      ruleId: alert.rule.id,
      level,
      groups,
      agent: alert.agent ? { id: alert.agent.id, name: alert.agent.name, ip: alert.agent.ip } : undefined,
      timestamp: alert.timestamp,
      mitre,
      location: alert.location,
      fullLog: alert.full_log ? truncate(alert.full_log, 2000) : undefined,
    },
  };
}

// ── Vulnerability-detector alert → Vulnerability payload ──────────────────────

export type VulnSeverityValue = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";

export type WazuhVulnPayload = {
  vulnId: string;
  title: string;
  cveId: string;
  description: string;
  severity: VulnSeverityValue;
  cvssScore: number | null;
  affectedComponent: string;
  remediation: string | null;
  /** true when Wazuh reports the vulnerability as solved/removed. */
  solved: boolean;
  agentName: string;
};

function mapVulnSeverity(sev: string | undefined, score: number | null): VulnSeverityValue {
  switch ((sev ?? "").toLowerCase()) {
    case "critical": return "CRITICAL";
    case "high": return "HIGH";
    case "medium":
    case "moderate": return "MEDIUM";
    case "low": return "LOW";
  }
  if (score != null) {
    if (score >= 9) return "CRITICAL";
    if (score >= 7) return "HIGH";
    if (score >= 4) return "MEDIUM";
    if (score > 0) return "LOW";
  }
  return "INFORMATIONAL";
}

function sanitizeIdPart(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "unknown";
}

/**
 * Supports both shapes:
 *  - Wazuh 4.0–4.7: data.vulnerability.{cve,title,severity,cvss.cvss3.base_score,package.{name,version},status,reference,rationale}
 *  - Wazuh 4.8+:    data.vulnerability.{cve,title,severity,score.base,package.{name,version},status,reference,description}
 * Returns null when the alert isn't a usable vulnerability alert.
 */
export function mapWazuhVulnerability(alert: WazuhAlert): WazuhVulnPayload | null {
  if (!isVulnerabilityAlert(alert)) return null;
  const v = get(alert.data, ["vulnerability"]);
  const cve = getStr(v, ["cve"], ["id"]);
  if (!cve) return null;

  const agentName = alert.agent?.name ?? "unknown-agent";
  const pkgName = getStr(v, ["package", "name"]) ?? "unknown-package";
  const pkgVersion = getStr(v, ["package", "version"]);

  const rawScore = getStr(v, ["score", "base"], ["cvss", "cvss3", "base_score"], ["cvss", "cvss2", "base_score"]);
  const parsedScore = rawScore != null ? Number.parseFloat(rawScore) : NaN;
  const cvssScore = Number.isFinite(parsedScore) && parsedScore >= 0 && parsedScore <= 10 ? Math.round(parsedScore * 10) / 10 : null;

  const severity = mapVulnSeverity(getStr(v, ["severity"]), cvssScore);

  const status = (getStr(v, ["status"]) ?? "").toLowerCase();
  const ruleDesc = (alert.rule.description ?? "").toLowerCase();
  const solved =
    status === "solved" || status === "fixed" || status === "inactive" ||
    /\b(solved|was removed|no longer|resolved)\b/.test(ruleDesc);

  const title = getStr(v, ["title"]) ?? `${cve} affects ${pkgName}`;
  const description =
    getStr(v, ["description"], ["rationale"]) ??
    `${cve} detected by Wazuh vulnerability detector on agent ${agentName} (package ${pkgName}${pkgVersion ? ` ${pkgVersion}` : ""}).`;
  const reference = getStr(v, ["reference"]);
  const condition = getStr(v, ["package", "condition"]);
  const remediationParts = [
    condition ? `Affected condition: ${condition}. Update ${pkgName} to a fixed version.` : `Update ${pkgName} to a version that fixes ${cve}.`,
    reference ? `Reference: ${reference.split(",")[0].trim()}` : null,
  ].filter(Boolean);

  const vulnId = truncate(
    `WAZUH-${sanitizeIdPart(agentName)}-${sanitizeIdPart(cve)}-${sanitizeIdPart(pkgName)}`,
    190,
  );

  return {
    vulnId,
    title: truncate(title, 300),
    cveId: cve,
    description: truncate(description, 4000),
    severity,
    cvssScore,
    affectedComponent: truncate(`${agentName}: ${pkgName}${pkgVersion ? ` ${pkgVersion}` : ""}`, 300),
    remediation: remediationParts.join(" "),
    solved,
    agentName,
  };
}
