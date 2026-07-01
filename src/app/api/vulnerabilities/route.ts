import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { VulnSeverity, VulnStatus } from "@prisma/client";

const SEVERITY_ORDER: Record<VulnSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFORMATIONAL: 4,
};

const vulnSchema = z.object({
  vulnId: z.string().min(2),
  title: z.string().min(3),
  description: z.string().min(5),
  severity: z.nativeEnum(VulnSeverity),
  status: z.nativeEnum(VulnStatus).default("OPEN"),
  cveId: z.string().optional(),
  cvssScore: z.number().optional(),
  affectedComponent: z.string().optional(),
  source: z.string().optional(),
  remediation: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  assetId: z.string().optional(),
  assignedToId: z.string().optional(),
  controlId: z.string().optional(),
  companyId: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;
  const assetId = searchParams.get("assetId") ?? undefined;
  const companyId = searchParams.get("companyId") ?? undefined;

  const vulnerabilities = await getPrisma().vulnerability.findMany({
    where: {
      ...(status ? { status: status as VulnStatus } : {}),
      ...(severity ? { severity: severity as VulnSeverity } : {}),
      ...(assetId ? { assetId } : {}),
      ...(companyId ? { companyId } : {}),
    },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      control: { select: { id: true, controlId: true, title: true } },
    },
  });

  // Sort: severity CRITICAL first, then dueDate asc (nulls last)
  vulnerabilities.sort((a, b) => {
    const severityDiff =
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;
    const aDate = a.dueDate ? a.dueDate.getTime() : Infinity;
    const bDate = b.dueDate ? b.dueDate.getTime() : Infinity;
    return aDate - bDate;
  });

  return NextResponse.json(vulnerabilities);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");

  const body = await request.json().catch(() => null);
  const parsed = vulnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid vulnerability data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { dueDate, cvssScore, ...rest } = parsed.data;

  const vulnerability = await getPrisma().vulnerability.create({
    data: {
      ...rest,
      ...(cvssScore != null ? { cvssScore } : {}),
      ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      discoveredAt: new Date(),
      createdBy: session.user.id,
    },
    include: {
      asset: { select: { id: true, assetTag: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      control: { select: { id: true, controlId: true, title: true } },
    },
  });

  return NextResponse.json(vulnerability, { status: 201 });
}
