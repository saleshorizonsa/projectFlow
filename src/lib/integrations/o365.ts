/**
 * Microsoft 365 Management Activity API integration.
 *
 * Docs: https://learn.microsoft.com/en-us/office/office-365-management-api/office-365-management-activity-api-reference
 *
 * Auth: Azure AD app with application permission ActivityFeed.Read (no user interaction needed).
 * Flow: client_credentials → token → subscribe → poll content list → fetch blobs → map → logSecurityEvent
 */

import { logSecurityEvent, type SecurityEventInput } from "@/lib/security-events";

const MGMT_API = "https://manage.office.com/api/v1.0";

export const O365_CONTENT_TYPES = [
  { id: "Audit.AzureActiveDirectory", label: "Azure AD (sign-ins, users, roles)" },
  { id: "Audit.Exchange",             label: "Exchange Online (email, rules)" },
  { id: "Audit.SharePoint",           label: "SharePoint / OneDrive" },
  { id: "Audit.General",             label: "General Admin Activity" },
] as const;

export type O365Config = {
  contentTypes: string[];
};

// ── OAuth2 token ──────────────────────────────────────────────────────────────

export async function getO365Token(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         "https://manage.office.com/.default",
  });
  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`O365 token error ${res.status}: ${err}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("O365: no access_token in response");
  return data.access_token as string;
}

/** Quick credentials test — returns null on success, error message on failure. */
export async function testO365Connection(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  try {
    await getO365Token(tenantId, clientId, clientSecret);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Unknown error";
  }
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

/** Idempotent: creates subscription if it doesn't exist. */
async function ensureSubscription(
  token:       string,
  tenantId:    string,
  contentType: string,
): Promise<void> {
  const url = `${MGMT_API}/${tenantId}/activity/feed/subscriptions/start?contentType=${contentType}&PublisherIdentifier=${tenantId}`;
  const res = await fetch(url, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    "{}",
  });
  // 200 = already exists, 201 = created, both fine. Other errors silently ignored
  // (insufficient permissions will surface during content listing)
  void res;
}

// ── Content listing & fetching ────────────────────────────────────────────────

type ContentItem = { contentUri: string; contentId: string };

async function listAvailableContent(
  token:       string,
  tenantId:    string,
  contentType: string,
  startTime:   Date,
  endTime:     Date,
): Promise<string[]> {
  // API only supports a 24 h window per call
  const fmt = (d: Date) => d.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss
  const url = `${MGMT_API}/${tenantId}/activity/feed/subscriptions/content` +
    `?contentType=${contentType}` +
    `&startTime=${fmt(startTime)}` +
    `&endTime=${fmt(endTime)}` +
    `&PublisherIdentifier=${tenantId}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    if (res.status === 404 || res.status === 400) return [];
    throw new Error(`O365 list content error ${res.status} for ${contentType}`);
  }
  const data: ContentItem[] = await res.json().catch(() => []);
  const uris = Array.isArray(data) ? data.map(i => i.contentUri) : [];

  // Follow NextPageUri header if present (pagination)
  const nextPage = res.headers.get("NextPageUri");
  if (nextPage) {
    const nextRes = await fetch(nextPage, { headers: { Authorization: `Bearer ${token}` } });
    if (nextRes.ok) {
      const nextData: ContentItem[] = await nextRes.json().catch(() => []);
      if (Array.isArray(nextData)) uris.push(...nextData.map(i => i.contentUri));
    }
  }
  return uris;
}

async function fetchContentBlob(
  token: string,
  uri:   string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(uri, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data: unknown = await res.json().catch(() => []);
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

// ── Event mapping ─────────────────────────────────────────────────────────────

const OPERATION_TYPE_MAP: Record<string, string> = {
  // ─ Azure AD auth ─
  "UserLoggedIn":                     "LOGIN_SUCCESS",
  "UserLoginFailed":                  "LOGIN_FAILURE",
  // ─ User lifecycle ─
  "Add user.":                        "USER_CREATED",
  "Delete user.":                     "USER_DELETED",
  "Update user.":                     "EMPLOYEE_MODIFIED",
  "Change user password.":            "PASSWORD_CHANGED",
  "Set user password.":               "PASSWORD_CHANGED",
  "Reset user password.":             "PASSWORD_CHANGED",
  "Restore user.":                    "USER_CREATED",
  "Disable account.":                 "USER_DELETED",
  "Enable account.":                  "USER_CREATED",
  // ─ MFA ─
  "Disable Strong Authentication.":   "MFA_DISABLED",
  "Enable Strong Authentication.":    "MFA_ENABLED",
  "User registered security info":    "MFA_ENABLED",
  "User deleted security info":       "MFA_DISABLED",
  "User changed default security info": "MFA_ENABLED",
  // ─ Role / privilege ─
  "Add member to role.":              "ROLE_CHANGED",
  "Remove member from role.":         "ROLE_CHANGED",
  "Add eligible member to role.":     "ROLE_CHANGED",
  "Remove eligible member from role.":"ROLE_CHANGED",
  "SiteCollectionAdminAdded":         "ROLE_CHANGED",
  "SiteCollectionAdminRemoved":       "ROLE_CHANGED",
  // ─ Exchange persistence / config ─
  "New-InboxRule":                    "CONFIG_CHANGED",
  "Set-InboxRule":                    "CONFIG_CHANGED",
  "Remove-InboxRule":                 "CONFIG_CHANGED",
  "Add-MailboxPermission":            "CONFIG_CHANGED",
  "Remove-MailboxPermission":         "CONFIG_CHANGED",
  "Set-MailboxAutoReplyConfiguration":"CONFIG_CHANGED",
  "Set-TransportRule":                "CONFIG_CHANGED",
  "New-TransportRule":                "CONFIG_CHANGED",
  "Remove-TransportRule":             "CONFIG_CHANGED",
  // ─ SharePoint / OneDrive ─
  "SharingSet":                       "CONFIG_CHANGED",
  "SharingInvitationCreated":         "CONFIG_CHANGED",
  "AnonymousLinkCreated":             "SUSPICIOUS_ACTIVITY",
  // ─ App / OAuth consent (high-risk) ─
  "Consent to application.":          "SUSPICIOUS_ACTIVITY",
  "Add service principal.":           "SUSPICIOUS_ACTIVITY",
  "Add OAuth2PermissionGrant.":       "SUSPICIOUS_ACTIVITY",
  "Add app role assignment to service principal.": "SUSPICIOUS_ACTIVITY",
  // ─ Policy changes ─
  "Set DirSyncEnabled.":              "CONFIG_CHANGED",
  "Set Company Information.":         "CONFIG_CHANGED",
};

const OPERATION_MITRE_MAP: Record<string, string> = {
  "UserLoginFailed":                  "Credential Access",
  "Add member to role.":              "Privilege Escalation",
  "Add eligible member to role.":     "Privilege Escalation",
  "Disable Strong Authentication.":   "Defense Evasion",
  "User deleted security info":       "Defense Evasion",
  "New-InboxRule":                    "Persistence",
  "Set-InboxRule":                    "Persistence",
  "Add-MailboxPermission":            "Persistence",
  "Consent to application.":          "Persistence",
  "Add service principal.":           "Persistence",
  "Add OAuth2PermissionGrant.":       "Persistence",
  "SharingSet":                       "Exfiltration",
  "AnonymousLinkCreated":             "Exfiltration",
};

function mapO365Record(record: Record<string, unknown>): SecurityEventInput | null {
  const operation = String(record.Operation ?? "");
  const type = OPERATION_TYPE_MAP[operation];
  if (!type) return null;

  const userId    = String(record.UserId      ?? record.UserKey ?? "");
  const workload  = String(record.Workload    ?? "O365");
  const ip        = String(record.ActorIpAddress ?? record.ClientIP ?? record.IpAddress ?? "").replace("::ffff:", "") || undefined;
  const createdAt = String(record.CreationTime ?? "");

  return {
    type,
    actor:       userId || undefined,
    actorIp:     ip,
    resource:    `O365/${workload}`,
    resourceId:  String(record.ObjectId ?? record.Id ?? ""),
    description: `[O365] ${operation} — ${userId || "unknown"} via ${workload}`,
    mitreTactic: OPERATION_MITRE_MAP[operation],
    metadata:    { source: "o365", operation, workload, createdAt, objectId: record.ObjectId },
  };
}

// ── Main sync function ────────────────────────────────────────────────────────

export type SyncResult = {
  eventsIngested: number;
  contentUrisFetched: number;
  errors: string[];
};

export async function syncO365(
  tenantId:     string,
  clientId:     string,
  clientSecret: string,
  config:       O365Config,
  lastSyncAt:   Date | null,
): Promise<SyncResult> {
  const result: SyncResult = { eventsIngested: 0, contentUrisFetched: 0, errors: [] };

  const token = await getO365Token(tenantId, clientId, clientSecret);

  const endTime   = new Date();
  // Max lookback: 24 h (API limit); also don't go further than 7 days (retention limit)
  const maxLookbackMs = Math.min(24 * 3_600_000, 7 * 24 * 3_600_000);
  const startTime = lastSyncAt
    ? new Date(Math.max(lastSyncAt.getTime(), endTime.getTime() - maxLookbackMs))
    : new Date(endTime.getTime() - maxLookbackMs);

  // Ensure window is at least 1 minute to avoid API rejecting identical start/end
  if (endTime.getTime() - startTime.getTime() < 60_000) return result;

  const contentTypes = config.contentTypes?.length ? config.contentTypes : ["Audit.AzureActiveDirectory"];

  for (const contentType of contentTypes) {
    try {
      await ensureSubscription(token, tenantId, contentType);
      const uris = await listAvailableContent(token, tenantId, contentType, startTime, endTime);
      result.contentUrisFetched += uris.length;

      for (const uri of uris) {
        try {
          const records = await fetchContentBlob(token, uri);
          for (const record of records) {
            const event = mapO365Record(record);
            if (event) {
              await logSecurityEvent(event);
              result.eventsIngested++;
            }
          }
        } catch (e) {
          result.errors.push(`fetch blob: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      result.errors.push(`${contentType}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
