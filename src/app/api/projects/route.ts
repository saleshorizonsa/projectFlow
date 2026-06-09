import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { projectSchema } from "@/lib/validators";
import { layerDefinitions, type LayerKey } from "@/lib/layers";

export async function GET() {
  await requireRole("VIEWER");
  const projects = await getPrisma().project.findMany({
    include: {
      manager: true,
      companies: { include: { company: true } },
      layers: true,
      _count: { select: { tasks: true, gaps: true, milestones: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const session = await requireRole("PROJECT_MANAGER");
  const parsed = projectSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project data", details: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data;
  const { companyIds, ...projectPayload } = payload;
  const companies = await getPrisma().company.findMany({
    where: { id: { in: companyIds }, active: true },
    orderBy: { name: "asc" },
  });

  if (companies.length !== companyIds.length) {
    return NextResponse.json({ error: "One or more selected companies are unavailable." }, { status: 400 });
  }

  const project = await getPrisma().project.create({
    data: {
      ...projectPayload,
      client: companies.map((company) => company.name).join(", "),
      budget: payload.budget,
      createdBy: session.user.id,
      companies: {
        create: companies.map((company) => ({
          companyId: company.id,
          createdBy: session.user.id,
        })),
      },
      layers: {
        create: (Object.keys(layerDefinitions) as LayerKey[]).map((type) => ({
          type,
          name: type.charAt(0) + type.slice(1).toLowerCase(),
          createdBy: session.user.id,
          subLayers: {
            create: layerDefinitions[type].map((name, order) => ({
              name,
              order,
              createdBy: session.user.id,
            })),
          },
        })),
      },
    },
  });
  return NextResponse.json(project, { status: 201 });
}
