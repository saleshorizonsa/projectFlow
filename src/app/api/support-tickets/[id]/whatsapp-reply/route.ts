import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { z } from "zod";

const schema = z.object({ message: z.string().min(1).max(4096) });
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await requireRole("TEAM_MEMBER");
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const ticket = await getPrisma().supportTicket.findUnique({
    where: { id },
    select: { id: true, whatsappFrom: true },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  if (!ticket.whatsappFrom) {
    return NextResponse.json({ error: "This ticket has no WhatsApp contact to reply to." }, { status: 400 });
  }
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return NextResponse.json({ error: "WhatsApp is not configured on this server." }, { status: 503 });
  }

  const waRes = await fetch(
    `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: ticket.whatsappFrom,
        type: "text",
        text: { preview_url: false, body: parsed.data.message },
      }),
    },
  );
  if (!waRes.ok) {
    const err = await waRes.text();
    return NextResponse.json({ error: `WhatsApp delivery failed: ${err}` }, { status: 502 });
  }

  await getPrisma().supportTicket.update({
    where: { id },
    data: {
      updatedBy: session.user.id,
      events: {
        create: {
          body: parsed.data.message,
          direction: "OUTBOUND",
          source: "WHATSAPP",
          authorId: session.user.id,
          createdBy: session.user.id,
        },
      },
    },
  });

  return NextResponse.json({ ok: true });
}
