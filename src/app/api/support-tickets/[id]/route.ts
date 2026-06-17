import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { calculateSla } from "@/lib/sla";
import { supportTicketUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("TEAM_MEMBER");
  const { id } = await context.params;
  const parsed = supportTicketUpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid support ticket data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { eventBody, ticketNo: _ticketNo, ...data } = parsed.data;
  const status = data.status;
  const existing = await getPrisma().supportTicket.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  const nextPriority = data.priority;
  const priorityChanged = Boolean(nextPriority && nextPriority !== existing.priority);
  const sla = nextPriority && priorityChanged ? calculateSla(nextPriority, existing.createdAt) : null;
  const ticket = await getPrisma().supportTicket.update({
    where: { id },
    data: {
      ...data,
      ...(sla ? { firstResponseDueAt: sla.firstResponseDueAt, resolveDueAt: sla.resolveDueAt } : {}),
      employeeId: data.employeeId === "" ? null : data.employeeId,
      assetId: data.assetId === "" ? null : data.assetId,
      licenseId: data.licenseId === "" ? null : data.licenseId,
      assignedToId: data.assignedToId === "" ? null : data.assignedToId,
      respondedAt: eventBody && !existing.respondedAt ? new Date() : undefined,
      resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : status ? null : undefined,
      updatedBy: session.user.id,
      ...(eventBody ? {
        events: {
          create: {
            body: eventBody,
            direction: "INTERNAL",
            source: "PORTAL",
            authorId: session.user.id,
            createdBy: session.user.id,
          },
        },
      } : {}),
    },
    include: { company: true, employee: true, asset: true, license: true, assignedTo: true, events: true },
  });

  return NextResponse.json(ticket);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;
  await getPrisma().supportTicket.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
