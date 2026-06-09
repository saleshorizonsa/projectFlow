import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import { itMaintenanceSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");
  const parsed = itMaintenanceSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid maintenance data", details: parsed.error.flatten() }, { status: 400 });
  }

  const maintenance = await getPrisma().iTMaintenance.create({
    data: { ...parsed.data, createdBy: session.user.id },
  });

  return NextResponse.json(maintenance, { status: 201 });
}
