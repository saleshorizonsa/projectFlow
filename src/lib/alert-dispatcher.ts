import { AlertChannel, AlertDeliveryStatus, type Notification, type PrismaClient, type User } from "@prisma/client";
import nodemailer from "nodemailer";

type AlertRecipient = {
  user?: Pick<User, "id" | "email" | "phone"> | null;
  email?: string | null;
  whatsapp?: string | null;
};

type AlertPayload = {
  title: string;
  message: string;
  notification?: Pick<Notification, "id"> | null;
  recipient: AlertRecipient;
};

export async function dispatchAlert(prisma: PrismaClient, payload: AlertPayload) {
  await Promise.all([
    dispatchEmail(prisma, payload),
    dispatchWhatsApp(prisma, payload),
  ]);
}

// Deadline and escalation notifications are recreated once the previous copy is read or dismissed,
// so they alert at most once per day per user and title to avoid repeat emails on every page view.
export async function dispatchNotificationAlert(
  prisma: PrismaClient,
  notification: Pick<Notification, "id" | "userId" | "title" | "message">,
) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.alertDelivery.findFirst({
    where: { userId: notification.userId, title: notification.title, createdAt: { gte: since } },
    select: { id: true },
  });
  if (recent) return;

  const user = await prisma.user.findUnique({
    where: { id: notification.userId },
    select: { id: true, email: true, phone: true },
  });
  if (!user) return;

  await dispatchAlert(prisma, {
    title: notification.title,
    message: notification.message,
    notification,
    recipient: { user },
  });
}

async function dispatchEmail(prisma: PrismaClient, payload: AlertPayload) {
  const recipient = payload.recipient.email || payload.recipient.user?.email;
  if (!recipient) return;

  const provider = emailProvider();
  const configError = emailConfigError(provider);
  if (configError) {
    await logDelivery(prisma, payload, {
      channel: AlertChannel.EMAIL,
      recipient,
      provider,
      status: AlertDeliveryStatus.SKIPPED,
      error: configError,
    });
    return;
  }

  try {
    await sendEmail(recipient, payload.title, payload.message);

    await logDelivery(prisma, payload, {
      channel: AlertChannel.EMAIL,
      recipient,
      provider,
      status: AlertDeliveryStatus.SENT,
    });
  } catch (error) {
    await logDelivery(prisma, payload, {
      channel: AlertChannel.EMAIL,
      recipient,
      provider,
      status: AlertDeliveryStatus.FAILED,
      error: error instanceof Error ? error.message : "Email delivery failed.",
    });
  }
}

// ALERT_EMAIL_PROVIDER: "resend" (default) | "gmail" | "office365" | "smtp".
// gmail / office365 / smtp authenticate with SMTP_USER + SMTP_PASS (a Google App Password for gmail);
// smtp also needs SMTP_HOST and optionally SMTP_PORT.
const SMTP_PRESETS: Record<string, { host: string; port: number }> = {
  gmail: { host: "smtp.gmail.com", port: 465 },
  office365: { host: "smtp.office365.com", port: 587 },
};

export function emailProvider() {
  return (process.env.ALERT_EMAIL_PROVIDER || "resend").trim().toLowerCase();
}

export function emailConfigError(provider = emailProvider()): string | null {
  if (provider === "resend") {
    return process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL
      ? null
      : "RESEND_API_KEY or ALERT_FROM_EMAIL is not configured.";
  }
  if (provider === "gmail" || provider === "office365" || provider === "smtp") {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return "SMTP_USER or SMTP_PASS is not configured.";
    if (provider === "smtp" && !process.env.SMTP_HOST) return "SMTP_HOST is not configured.";
    return null;
  }
  return `Unknown ALERT_EMAIL_PROVIDER "${provider}". Use resend, gmail, office365 or smtp.`;
}

export async function sendEmail(to: string, subject: string, text: string) {
  const provider = emailProvider();
  const configError = emailConfigError(provider);
  if (configError) throw new Error(configError);

  if (provider === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.ALERT_FROM_EMAIL,
        to: [to],
        subject,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }
    return;
  }

  const preset = SMTP_PRESETS[provider];
  const port = preset?.port ?? Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: preset?.host ?? process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  // Gmail and Office 365 reject a From address other than the signed-in mailbox, so default to it.
  const from = process.env.ALERT_FROM_EMAIL || `JASCOMiyaar <${process.env.SMTP_USER}>`;
  await transport.sendMail({ from, to, subject, text });
}

async function dispatchWhatsApp(prisma: PrismaClient, payload: AlertPayload) {
  const recipient = normalizePhone(payload.recipient.whatsapp || payload.recipient.user?.phone || "");
  if (!recipient) return;

  const provider = "whatsapp-cloud";
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    await logDelivery(prisma, payload, {
      channel: AlertChannel.WHATSAPP,
      recipient,
      provider,
      status: AlertDeliveryStatus.SKIPPED,
      error: "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured.",
    });
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: { preview_url: false, body: `${payload.title}\n\n${payload.message}` },
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    await logDelivery(prisma, payload, {
      channel: AlertChannel.WHATSAPP,
      recipient,
      provider,
      status: AlertDeliveryStatus.SENT,
    });
  } catch (error) {
    await logDelivery(prisma, payload, {
      channel: AlertChannel.WHATSAPP,
      recipient,
      provider,
      status: AlertDeliveryStatus.FAILED,
      error: error instanceof Error ? error.message : "WhatsApp delivery failed.",
    });
  }
}

async function logDelivery(
  prisma: PrismaClient,
  payload: AlertPayload,
  delivery: { channel: AlertChannel; recipient: string; provider: string; status: AlertDeliveryStatus; error?: string },
) {
  await prisma.alertDelivery.create({
    data: {
      notificationId: payload.notification?.id ?? null,
      userId: payload.recipient.user?.id ?? null,
      channel: delivery.channel,
      recipient: delivery.recipient,
      title: payload.title,
      message: payload.message,
      provider: delivery.provider,
      status: delivery.status,
      error: delivery.error ?? null,
    },
  });
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}
