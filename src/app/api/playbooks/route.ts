import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { IncidentType } from "@prisma/client";

const playbookCreateSchema = z.object({
  title: z.string().min(1),
  type: z.nativeEnum(IncidentType),
  description: z.string().optional(),
  steps: z.array(z.unknown()).optional(),
  companyId: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? undefined;
  const companyId = searchParams.get("companyId") ?? undefined;

  const playbooks = await getPrisma().incidentPlaybook.findMany({
    where: {
      ...(type ? { type: type as IncidentType } : {}),
      ...(companyId ? { companyId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(playbooks);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");

  const body = await request.json().catch(() => null);
  const parsed = playbookCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid playbook data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { steps, ...rest } = parsed.data;

  const playbook = await getPrisma().incidentPlaybook.create({
    data: {
      ...rest,
      playbookId: `PB-${Date.now()}`,
      steps: (steps ?? []) as object[],
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(playbook, { status: 201 });
}
