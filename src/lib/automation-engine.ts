import { addDays, differenceInCalendarDays, differenceInYears } from "date-fns";
import { NotificationType, type PrismaClient, type User } from "@prisma/client";
import { dispatchAlert } from "@/lib/alert-dispatcher";
import { getPrisma } from "@/lib/prisma";

type AutomationResult = {
  name: string;
  count: number;
  description: string;
};

export async function runAutomationEngine(prisma: PrismaClient = getPrisma(), now = new Date()): Promise<AutomationResult[]> {
  const [slaBreaches, licenseRenewals, assetLifecycle, maintenanceDue] = await Promise.all([
    syncSlaBreaches(prisma, now),
    syncLicenseRenewals(prisma, now),
    syncAssetLifecycle(prisma, now),
    syncMaintenanceDue(prisma, now),
  ]);

  return [
    { name: "SLA breach escalation", count: slaBreaches, description: "Open tickets past response or resolution SLA create assignee/admin alerts." },
    { name: "License renewal alerts", count: licenseRenewals, description: "Licenses expiring in 45 days create owner/admin renewal alerts." },
    { name: "Asset lifecycle review", count: assetLifecycle, description: "Assets near or past lifecycle create custodian/admin upgrade alerts." },
    { name: "Maintenance reminders", count: maintenanceDue, description: "Maintenance due within 7 days creates responsible-user alerts." },
  ];
}

async function syncSlaBreaches(prisma: PrismaClient, now: Date) {
  const tickets = await prisma.supportTicket.findMany({
    where: {
      status: { notIn: ["RESOLVED", "CLOSED"] },
      OR: [
        { firstResponseDueAt: { lt: now }, respondedAt: null },
        { resolveDueAt: { lt: now } },
      ],
    },
    include: { assignedTo: true, company: true },
  });

  for (const ticket of tickets) {
    const users = await alertUsers(prisma, ticket.assignedToId);
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { slaBreached: true, escalatedAt: ticket.escalatedAt ?? now },
    });
    await Promise.all(users.map((user) => createNotification(prisma, {
      user,
      type: NotificationType.SLA_BREACH,
      title: `SLA breached: ${ticket.ticketNo}`,
      message: `${ticket.company.code} ticket "${ticket.title}" is past SLA and needs escalation.`,
    })));
  }

  return tickets.length;
}

async function syncLicenseRenewals(prisma: PrismaClient, now: Date) {
  const soon = addDays(now, 45);
  const licenses = await prisma.iTLicense.findMany({
    where: { expiryDate: { lte: soon } },
    include: { asset: { include: { assignedTo: true, companies: { include: { company: true } } } }, employee: true },
  });
  const admins = await adminUsers(prisma);

  for (const license of licenses) {
    const days = differenceInCalendarDays(license.expiryDate, now);
    const users = await uniqueUsers(prisma, admins, license.asset?.assignedToId ? [license.asset.assignedToId] : []);
    await Promise.all(users.map((user) => createNotification(prisma, {
      user,
      type: NotificationType.LICENSE_EXPIRING,
      title: `License renewal due: ${license.name}`,
      message: `${license.vendor} license ${license.licenseId} expires ${days < 0 ? `${Math.abs(days)} day(s) ago` : `in ${days} day(s)`}.`,
    })));
  }

  return licenses.length;
}

async function syncAssetLifecycle(prisma: PrismaClient, now: Date) {
  const assets = await prisma.iTAsset.findMany({
    where: { status: { not: "RETIRED" } },
    include: { assignedTo: true, companies: { include: { company: true } } },
  });
  const reviewAssets = assets.filter((asset) => differenceInYears(now, asset.purchaseDate) >= asset.lifecycleYears - 1);
  const admins = await adminUsers(prisma);

  for (const asset of reviewAssets) {
    const age = differenceInYears(now, asset.purchaseDate);
    const users = await uniqueUsers(prisma, admins, asset.assignedToId ? [asset.assignedToId] : []);
    await Promise.all(users.map((user) => createNotification(prisma, {
      user,
      type: NotificationType.ASSET_LIFECYCLE,
      title: `Asset lifecycle review: ${asset.assetTag}`,
      message: `${asset.name} is ${age} year(s) old against ${asset.lifecycleYears} lifecycle year(s). Review upgrade or replacement.`,
    })));
  }

  return reviewAssets.length;
}

async function syncMaintenanceDue(prisma: PrismaClient, now: Date) {
  const soon = addDays(now, 7);
  const maintenances = await prisma.iTMaintenance.findMany({
    where: { scheduledAt: { lte: soon }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    include: { asset: true, responsible: true },
  });

  for (const maintenance of maintenances) {
    await createNotification(prisma, {
      user: maintenance.responsible,
      type: NotificationType.MAINTENANCE_DUE,
      title: `Maintenance due: ${maintenance.maintenanceId}`,
      message: `${maintenance.title} for ${maintenance.asset.assetTag} is scheduled on ${maintenance.scheduledAt.toLocaleString()}.`,
    });
  }

  return maintenances.length;
}

async function createNotification(prisma: PrismaClient, data: { user: Pick<User, "id" | "email" | "phone">; type: NotificationType; title: string; message: string }) {
  const existing = await prisma.notification.findFirst({
    where: { userId: data.user.id, type: data.type, title: data.title, message: data.message, readAt: null },
  });
  if (existing) return;
  const notification = await prisma.notification.create({
    data: {
      userId: data.user.id,
      type: data.type,
      title: data.title,
      message: data.message,
    },
  });
  await dispatchAlert(prisma, {
    title: data.title,
    message: data.message,
    notification,
    recipient: { user: data.user },
  });
}

async function adminUsers(prisma: PrismaClient) {
  return prisma.user.findMany({ where: { role: { name: "ADMIN" } }, select: { id: true, email: true, phone: true } });
}

async function alertUsers(prisma: PrismaClient, primaryUserId?: string | null) {
  return uniqueUsers(prisma, await adminUsers(prisma), primaryUserId ? [primaryUserId] : []);
}

async function uniqueUsers(prisma: PrismaClient, users: Pick<User, "id" | "email" | "phone">[], ids: string[]) {
  const extraUsers = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, phone: true } })
    : [];
  const byId = new Map<string, Pick<User, "id" | "email" | "phone">>();
  for (const user of [...users, ...extraUsers]) byId.set(user.id, user);
  return [...byId.values()];
}
