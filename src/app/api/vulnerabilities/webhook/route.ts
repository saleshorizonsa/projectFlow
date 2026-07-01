import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { VulnSeverity, VulnStatus } from "@prisma/client";

const webhookSchema = z.object({
  vulnId: z.string().min(2),
  title: z.string().min(3),
  description: z.string().min(5),
  severity: z.nativeEnum(VulnSeverity),
  status: z.nativeEnum(VulnStatus).default("OPEN"),
  cveId: z.string().optional(),
  cvssScore: z.number().optional(),
  affectedComponent: z.string().optional(),
  remediation: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  assetId: z.string().optional(),
  assignedToId: z.string().optional(),
  controlId: z.string().optional(),
  companyId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const secret = process.env.VULNERABILITY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook endpoint not configured" },
      { status: 501 }
    );
  }

  const providedSecret = request.headers.get("x-webhook-secret");
  if (!providedSecret || providedSecret !== secret) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid vulnerability data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { dueDate, cvssScore, ...rest } = parsed.data;

  try {
    const vulnerability = await getPrisma().vulnerability.create({
      data: {
        ...rest,
        source: "webhook",
        ...(cvssScore != null ? { cvssScore } : {}),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        discoveredAt: new Date(),
        createdBy: "webhook",
      },
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        control: { select: { id: true, controlId: true, title: true } },
      },
    });

    return NextResponse.json(vulnerability, { status: 201 });
  } catch (err: unknown) {
    // Prisma unique constraint violation code
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Vulnerability with this vulnId already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}
