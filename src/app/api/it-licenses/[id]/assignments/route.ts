import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  await requireRole("VIEWER");
  const { id } = await context.params;
  const assignments = await getPrisma().licenseAssignment.findMany({
    where: { licenseId: id },
    include: { employee: { select: { id: true, employeeId: true, name: true, department: true, jobTitle: true } } },
    orderBy: { assignedAt: "desc" },
  });
  return NextResponse.json(assignments);
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const body = await request.json().catch(() => null);
  const employeeId: string | undefined = body?.employeeId;
  const notes: string | undefined = body?.notes;

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required." }, { status: 400 });
  }

  const license = await getPrisma().iTLicense.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true } } },
  });
  if (!license) return NextResponse.json({ error: "License not found." }, { status: 404 });

  if (license._count.assignments >= license.seats) {
    return NextResponse.json(
      { error: `No seats available. This license has ${license.seats} seat(s) and all are assigned.` },
      { status: 409 },
    );
  }

  const employee = await getPrisma().employee.findUnique({ where: { id: employeeId } });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  try {
    const assignment = await getPrisma().licenseAssignment.create({
      data: {
        licenseId: id,
        employeeId,
        assignedBy: session.user.id,
        ...(notes ? { notes } : {}),
      },
      include: { employee: { select: { id: true, employeeId: true, name: true, department: true } } },
    });
    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "This employee already has a seat on this license." }, { status: 409 });
    }
    return NextResponse.json({ error: "Assignment could not be saved." }, { status: 500 });
  }
}
