import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { IncidentType } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const playbookUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.nativeEnum(IncidentType).optional(),
  description: z.string().optional().nullable(),
  steps: z.array(z.unknown()).optional(),
  companyId: z.string().optional().nullable(),
});

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const playbook = await getPrisma().incidentPlaybook.findUnique({
    where: { id },
  });

  if (!playbook) {
    return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
  }

  return NextResponse.json(playbook);
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireRole("PROJECT_MANAGER");
  const { id } = await context.params;

  const existing = await getPrisma().incidentPlaybook.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = playbookUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid playbook data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { steps, ...rest } = parsed.data;
  const playbook = await getPrisma().incidentPlaybook.update({
    where: { id },
    data: {
      ...rest,
      ...(steps !== undefined ? { steps: steps as object[] } : {}),
      updatedBy: session.user.id,
    },
  });

  return NextResponse.json(playbook);
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireRole("ADMIN");
  const { id } = await context.params;

  const existing = await getPrisma().incidentPlaybook.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
  }

  await getPrisma().incidentPlaybook.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
