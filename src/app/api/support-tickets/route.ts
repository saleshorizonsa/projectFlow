import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { calculateSla } from "@/lib/sla";
import { supportTicketSchema } from "@/lib/validators";

export async function GET() {
  await requireRole("VIEWER");
  const tickets = await getPrisma().supportTicket.findMany({
    include: {
      company: true,
      employee: true,
      asset: true,
      license: true,
      assignedTo: true,
      events: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(tickets);
}

export async function POST(request: Request) {
  const session = await requireRole("TEAM_MEMBER");
  const parsed = supportTicketSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid support ticket data", details: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrisma();
  const payload = parsed.data;
  const validationError = await validateTicketLinks(payload.companyId, payload.employeeId, payload.assetId, payload.licenseId, payload.assignedToId);
  if (validationError) return validationError;

  const ticketNo = payload.ticketNo?.trim() || await nextTicketNo();
  const createdAt = new Date();
  const sla = calculateSla(payload.priority, createdAt);
  const ticket = await prisma.supportTicket.create({
    data: {
      ...payload,
      ticketNo,
      firstResponseDueAt: sla.firstResponseDueAt,
      resolveDueAt: sla.resolveDueAt,
      employeeId: payload.employeeId || null,
      assetId: payload.assetId || null,
      licenseId: payload.licenseId || null,
      assignedToId: payload.assignedToId || null,
      requesterName: payload.requesterName || null,
      requesterPhone: payload.requesterPhone || null,
      resolvedAt: ["RESOLVED", "CLOSED"].includes(payload.status) ? new Date() : null,
      createdBy: session.user.id,
      events: {
        create: {
          body: `Ticket created: ${payload.description}`,
          direction: "INTERNAL",
          source: payload.source,
          authorId: session.user.id,
          createdBy: session.user.id,
        },
      },
    },
    include: { company: true, employee: true, asset: true, license: true, assignedTo: true, events: true },
  });

  return NextResponse.json(ticket, { status: 201 });
}

async function nextTicketNo() {
  const count = await getPrisma().supportTicket.count();
  return `IT-${String(count + 1).padStart(5, "0")}`;
}

async function validateTicketLinks(companyId: string, employeeId?: string, assetId?: string, licenseId?: string, assignedToId?: string) {
  const prisma = getPrisma();
  const company = await prisma.company.findFirst({ where: { id: companyId, active: true } });
  if (!company) return NextResponse.json({ error: "Selected company is unavailable." }, { status: 400 });

  if (employeeId) {
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, companies: { some: { companyId } } } });
    if (!employee) return NextResponse.json({ error: "Employee must belong to the selected company." }, { status: 400 });
  }

  if (assetId) {
    const asset = await prisma.iTAsset.findFirst({ where: { id: assetId, companies: { some: { companyId } } } });
    if (!asset) return NextResponse.json({ error: "Asset must belong to the selected company." }, { status: 400 });
  }

  if (licenseId) {
    const license = await prisma.iTLicense.findFirst({
      where: {
        id: licenseId,
        OR: [
          { asset: { companies: { some: { companyId } } } },
          { assetId: null },
        ],
      },
    });
    if (!license) return NextResponse.json({ error: "License must belong to the selected company context." }, { status: 400 });
  }

  if (assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
    if (!assignee) return NextResponse.json({ error: "Assigned support user does not exist." }, { status: 400 });
  }

  return null;
}
