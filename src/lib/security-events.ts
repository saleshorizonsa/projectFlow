import { getPrisma } from "@/lib/prisma";

export type SecurityEventInput = {
  type: string;
  severity?: string;
  actor?: string;
  actorIp?: string;
  resource?: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  mitreTactic?: string;
  companyId?: string;
};

export async function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    const severity = input.severity ?? deriveSeverity(input.type);
    await getPrisma().securityEvent.create({
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: input.type as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        severity: severity as any,
        actor: input.actor ?? null,
        actorIp: input.actorIp ?? null,
        resource: input.resource ?? null,
        resourceId: input.resourceId ?? null,
        description: input.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: (input.metadata ?? null) as any,
        mitreTactic: input.mitreTactic ?? null,
        companyId: input.companyId ?? null,
      },
    });
    // Process alert rules fire-and-forget — never block the caller
    void processAlertRules(input.type, input.companyId).catch(() => {});
  } catch {
    // Security logging must never crash the caller
  }
}

function deriveSeverity(type: string): string {
  if (["LOGIN_LOCKOUT", "SUSPICIOUS_ACTIVITY", "INCIDENT_ESCALATED", "VULNERABILITY_ESCALATED"].includes(type))
    return "HIGH";
  if (["LOGIN_FAILURE", "ROLE_CHANGED", "USER_DELETED", "ASSET_DELETED", "INCIDENT_CREATED", "CONFIG_CHANGED", "POLICY_CHANGED"].includes(type))
    return "MEDIUM";
  if (["LOGIN_SUCCESS", "MFA_ENABLED", "MFA_DISABLED", "ASSET_CREATED", "ASSET_MODIFIED", "EMPLOYEE_CREATED", "EMPLOYEE_MODIFIED"].includes(type))
    return "INFO";
  return "LOW";
}

async function processAlertRules(eventType: string, companyId?: string): Promise<void> {
  const db = getPrisma();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules = await db.alertRule.findMany({ where: { enabled: true, eventType: eventType as any } });

  for (const rule of rules) {
    const windowMs = rule.conditionWindowMin * 60 * 1000;
    const windowStart = new Date(Date.now() - windowMs);

    // Don't re-fire within the same window
    if (rule.lastFiredAt && rule.lastFiredAt >= windowStart) continue;

    const count = await db.securityEvent.count({
      where: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: eventType as any,
        createdAt: { gte: windowStart },
        ...(companyId ? { companyId } : {}),
      },
    });

    if (count >= rule.conditionCount) {
      if (rule.action === "CREATE_INCIDENT") {
        await db.incident.create({
          data: {
            incidentId: `INC-AUTO-${Date.now()}`,
            title: rule.incidentTitle ?? `[Alert] ${rule.name}`,
            description: `Alert rule "${rule.name}" triggered: ${count} ${eventType.replace(/_/g, " ")} event${count > 1 ? "s" : ""} in ${rule.conditionWindowMin} min.`,
            type: "OTHER",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            severity: (rule.incidentSeverity ?? "HIGH") as any,
            status: "REPORTED",
            mitreTactic: rule.mitreTactic ?? null,
            mitreTechnique: rule.mitreTechnique ?? null,
            ...(companyId ? { companyId } : {}),
          },
        });
      }
      await db.alertRule.update({ where: { id: rule.id }, data: { lastFiredAt: new Date() } });
    }
  }
}
