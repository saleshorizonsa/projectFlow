import { getPrisma } from "@/lib/prisma";

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGIN_BLOCKED"
  | "ACCOUNT_LOCKED"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "EXPORT"
  | "PERMISSION_DENIED";

export async function audit(opts: {
  userId?: string;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}) {
  try {
    await getPrisma().auditLog.create({
      data: {
        userId: opts.userId ?? null,
        action: opts.action,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        detail: opts.detail ? JSON.parse(JSON.stringify(opts.detail)) : undefined,
        ip: opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
      },
    });
  } catch {
    // Never let audit failures break the main flow
  }
}
