import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { FindingSeverity, FindingStatus } from "@prisma/client";

const SEVERITY_ORDER: FindingSeverity[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFORMATIONAL",
];

const findingCreateSchema = z.object({
  findingId: z.string().min(3),
  title: z.string().min(3),
  description: z.string().min(5),
  severity: z.nativeEnum(FindingSeverity),
  status: z.nativeEnum(FindingStatus).default("OPEN"),
  controlId: z.string().optional(),
  responsibleId: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  await requireRole("VIEWER");

  const { searchParams } = new URL(request.url);
  const controlIdFilter = searchParams.get("controlId") ?? undefined;
  const statusFilter = searchParams.get("status") as FindingStatus | null;

  const findings = await getPrisma().auditFinding.findMany({
    where: {
      ...(controlIdFilter ? { controlId: controlIdFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      control: {
        select: { controlId: true, title: true },
      },
      responsible: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      {
        severity: "asc",
      },
    ],
  });

  // Sort by severity in CRITICAL→INFORMATIONAL order (Prisma enum ordering
  // follows declaration order in schema which matches our desired order)
  const sorted = [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  return NextResponse.json(sorted);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = findingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid finding data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Check controlId exists if provided
  if (parsed.data.controlId) {
    const control = await getPrisma().complianceControl.findUnique({
      where: { id: parsed.data.controlId },
      select: { id: true },
    });
    if (!control) {
      return NextResponse.json(
        { error: "Referenced control not found" },
        { status: 400 },
      );
    }
  }

  const finding = await getPrisma().auditFinding.create({
    data: {
      ...parsed.data,
      createdBy: session.user.id,
    },
    include: {
      control: {
        select: { controlId: true, title: true },
      },
      responsible: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(finding, { status: 201 });
}
