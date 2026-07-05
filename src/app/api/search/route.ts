import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";

export async function GET(request: Request) {
  await requireRole("VIEWER");
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const contains = { contains: q, mode: "insensitive" as const };
  const take = 5;
  const db = getPrisma();

  const [projects, tasks, employees, assets, licenses, gaps, companies, tickets] = await Promise.all([
    db.project.findMany({
      where: { OR: [{ name: contains }, { projectId: contains }, { client: contains }] },
      select: { id: true, projectId: true, name: true, client: true, status: true },
      take,
    }),
    db.task.findMany({
      where: { OR: [{ title: contains }, { description: contains }] },
      select: { id: true, title: true, status: true, projectId: true },
      take,
    }),
    db.employee.findMany({
      where: { OR: [{ name: contains }, { employeeId: contains }, { email: contains }, { department: contains }] },
      select: { id: true, employeeId: true, name: true, department: true, jobTitle: true },
      take,
    }),
    db.iTAsset.findMany({
      where: { OR: [{ name: contains }, { assetTag: contains }, { vendor: contains }] },
      select: { id: true, assetTag: true, name: true, type: true, status: true },
      take,
    }),
    db.iTLicense.findMany({
      where: { OR: [{ name: contains }, { licenseId: contains }, { vendor: contains }] },
      select: { id: true, licenseId: true, name: true, vendor: true },
      take,
    }),
    db.gap.findMany({
      where: { OR: [{ title: contains }, { gapId: contains }, { description: contains }] },
      select: { id: true, gapId: true, title: true, status: true, projectId: true },
      take,
    }),
    db.company.findMany({
      where: { OR: [{ name: contains }, { code: contains }] },
      select: { id: true, name: true, code: true },
      take,
    }),
    db.supportTicket.findMany({
      where: { OR: [{ title: contains }, { description: contains }, { ticketNo: contains }] },
      select: { id: true, ticketNo: true, title: true, status: true, priority: true },
      take,
    }),
  ]);

  const results = [
    ...projects.map((p) => ({
      type: "project",
      id: p.id,
      title: p.name,
      subtitle: `${p.projectId} · ${p.client} · ${p.status.replace(/_/g, " ")}`,
      href: `/projects/${p.id}`,
    })),
    ...tasks.map((t) => ({
      type: "task",
      id: t.id,
      title: t.title,
      subtitle: `Task · ${t.status.replace(/_/g, " ")}`,
      href: t.projectId ? `/projects/${t.projectId}` : "/tasks",
    })),
    ...employees.map((e) => ({
      type: "employee",
      id: e.id,
      title: e.name,
      subtitle: `${e.employeeId} · ${e.department} · ${e.jobTitle}`,
      href: `/employees/${e.id}`,
    })),
    ...assets.map((a) => ({
      type: "asset",
      id: a.id,
      title: a.name,
      subtitle: `${a.assetTag} · ${a.type.replace(/_/g, " ")} · ${a.status.replace(/_/g, " ")}`,
      href: `/it-maintenance/assets?search=${a.assetTag}`,
    })),
    ...licenses.map((l) => ({
      type: "license",
      id: l.id,
      title: l.name,
      subtitle: `${l.licenseId} · ${l.vendor}`,
      href: `/it-maintenance/licenses?search=${l.licenseId}`,
    })),
    ...gaps.map((g) => ({
      type: "gap",
      id: g.id,
      title: g.title,
      subtitle: `${g.gapId} · ${g.status.replace(/_/g, " ")}`,
      href: `/projects/${g.projectId}`,
    })),
    ...companies.map((c) => ({
      type: "company",
      id: c.id,
      title: c.name,
      subtitle: c.code,
      href: "/companies",
    })),
    ...tickets.map((t) => ({
      type: "ticket",
      id: t.id,
      title: t.title,
      subtitle: `${t.ticketNo} · ${t.status.replace(/_/g, " ")} · ${t.priority}`,
      href: "/support/tickets",
    })),
  ];

  return NextResponse.json({ results });
}
