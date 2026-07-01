import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { VulnSeverity, VulnStatus } from "@prisma/client";

const MAX_ROWS = 500;

const importRowSchema = z.object({
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

const importBodySchema = z.array(importRowSchema).max(MAX_ROWS);

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body)) {
    return NextResponse.json(
      { error: "Body must be a JSON array of vulnerability rows" },
      { status: 400 }
    );
  }

  if (body.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ROWS} rows allowed per import` },
      { status: 400 }
    );
  }

  const parsed = importBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid import data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const now = new Date();
  const userId = session.user.id;

  const rows = parsed.data.map((row, index) => {
    const { dueDate, cvssScore, ...rest } = row;
    return {
      ...rest,
      vulnId: `CVE-IMPORT-${index}`,
      ...(cvssScore != null ? { cvssScore } : {}),
      ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      discoveredAt: now,
      createdBy: userId,
    };
  });

  const result = await getPrisma().vulnerability.createMany({
    data: rows,
    skipDuplicates: true,
  });

  const imported = result.count;
  const skipped = rows.length - imported;

  return NextResponse.json({ imported, skipped });
}
