import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const frameworks = await getPrisma().complianceFramework.findMany({
    orderBy: { code: "asc" },
    include: {
      domains: {
        orderBy: { order: "asc" },
        include: {
          controls: {
            orderBy: { controlId: "asc" },
            include: {
              responsible: { select: { id: true, name: true } },
              evidences: { orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, fileUrl: true, notes: true, createdAt: true } },
              findings: { select: { id: true, findingId: true, severity: true, status: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(frameworks);
}
