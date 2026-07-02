import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({}, { status: 401 });
  }

  const now = new Date();

  const [openIncidents, criticalVulns, highRisks, overdueTasks] =
    await Promise.all([
      getPrisma()
        .incident.count({
          where: {
            status: { notIn: ["RECOVERED", "CLOSED"] },
          },
        })
        .catch(() => 0),

      getPrisma()
        .vulnerability.count({
          where: {
            severity: "CRITICAL",
            status: { notIn: ["REMEDIATED", "ACCEPTED_RISK", "FALSE_POSITIVE"] },
          },
        })
        .catch(() => 0),

      getPrisma()
        .risk.count({
          where: {
            riskScore: { gte: 15 },
            status: { notIn: ["CLOSED"] },
          },
        })
        .catch(() => 0),

      getPrisma()
        .task.count({
          where: {
            dueDate: { lt: now },
            status: { not: "COMPLETED" },
          },
        })
        .catch(() => 0),
    ]);

  return NextResponse.json({ openIncidents, criticalVulns, highRisks, overdueTasks });
}
