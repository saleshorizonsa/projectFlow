import { AlertChannel, AlertDeliveryStatus, type Notification, type PrismaClient, type User } from "@prisma/client";

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

async function dispatchEmail(prisma: PrismaClient, payload: AlertPayload) {
  const recipient = payload.recipient.email || payload.recipient.user?.email;
  if (!recipient) return;

  const provider = process.env.ALERT_EMAIL_PROVIDER || "resend";
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_FROM_EMAIL) {
    await logDelivery(prisma, payload, {
      channel: AlertChannel.EMAIL,
      recipient,
      provider,
      status: AlertDeliveryStatus.SKIPPED,
      error: "RESEND_API_KEY or ALERT_FROM_EMAIL is not configured.",
    });
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.ALERT_FROM_EMAIL,
        to: [recipient],
        subject: payload.title,
        text: payload.message,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

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
