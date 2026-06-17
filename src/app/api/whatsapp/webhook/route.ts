import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { calculateSla } from "@/lib/sla";

type WhatsAppWebhook = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: { id?: string; from?: string; text?: { body?: string }; timestamp?: string }[];
      };
    }[];
  }[];
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const sig = request.headers.get("x-hub-signature-256") ?? "";
    const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    const sigBuf = Buffer.from(sig.padEnd(expected.length));
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const payload = JSON.parse(rawBody || "null") as WhatsAppWebhook | null;
  const messages = payload?.entry?.flatMap((entry) => entry.changes ?? []).flatMap((change) => change.value?.messages ?? []) ?? [];
  const contacts = payload?.entry?.flatMap((entry) => entry.changes ?? []).flatMap((change) => change.value?.contacts ?? []) ?? [];

  await Promise.all(messages.map(async (message) => {
    const body = message.text?.body?.trim();
    const from = normalizePhone(message.from ?? "");
    if (!body || !from) return;

    const contact = contacts.find((item) => normalizePhone(item.wa_id ?? "") === from);
    await createTicketFromWhatsApp({
      body,
      from,
      messageId: message.id,
      requesterName: contact?.profile?.name,
    });
  }));

  return NextResponse.json({ ok: true });
}

async function createTicketFromWhatsApp(input: { body: string; from: string; messageId?: string; requesterName?: string }) {
  const prisma = getPrisma();
  const duplicate = input.messageId
    ? await prisma.supportTicket.findFirst({ where: { whatsappMessageId: input.messageId } })
    : null;
  if (duplicate) return;

  const employee = await prisma.employee.findFirst({
    where: { phone: { contains: input.from } },
    include: { companies: { include: { company: true } }, assets: true, licenses: true },
  });
  const company = employee?.companies[0]?.company
    ?? await prisma.company.findFirst({ where: process.env.WHATSAPP_DEFAULT_COMPANY_ID ? { id: process.env.WHATSAPP_DEFAULT_COMPANY_ID } : { active: true }, orderBy: { name: "asc" } });
  if (!company) return;

  const count = await prisma.supportTicket.count();
  const title = input.body.length > 80 ? `${input.body.slice(0, 77)}...` : input.body;
  const createdAt = new Date();
  const sla = calculateSla("MEDIUM", createdAt);
  await prisma.supportTicket.create({
    data: {
      ticketNo: `IT-${String(count + 1).padStart(5, "0")}`,
      title,
      description: input.body,
      companyId: company.id,
      employeeId: employee?.id ?? null,
      assetId: employee?.assets[0]?.id ?? null,
      licenseId: employee?.licenses[0]?.id ?? null,
      category: "OTHER",
      priority: "MEDIUM",
      status: "OPEN",
      firstResponseDueAt: sla.firstResponseDueAt,
      resolveDueAt: sla.resolveDueAt,
      source: "WHATSAPP",
      requesterName: employee?.name ?? input.requesterName ?? null,
      requesterPhone: input.from,
      whatsappFrom: input.from,
      whatsappMessageId: input.messageId ?? null,
      events: {
        create: {
          body: input.body,
          direction: "INBOUND",
          source: "WHATSAPP",
          whatsappMessageId: input.messageId ?? null,
        },
      },
    },
  });
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}
