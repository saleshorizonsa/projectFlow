import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, email, roleId, phone, companyIds, password } = body;

    const prisma = getPrisma();
    const current = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Guard: cannot change own role
    if (id === session.user.id && roleId && roleId !== current.roleId) {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name.trim();
    if (email) {
      const clash = await prisma.user.findFirst({
        where: { email: email.toLowerCase().trim(), NOT: { id } },
      });
      if (clash) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      updateData.email = email.toLowerCase().trim();
    }
    if (roleId) updateData.roleId = roleId;
    if (phone !== undefined) updateData.phone = phone || null;
    if (password) updateData.passwordHash = await hash(password, 12);
    updateData.updatedBy = session.user.id;

    const user = await prisma.$transaction(async (tx) => {
      if (companyIds !== undefined) {
        await tx.userCompany.deleteMany({ where: { userId: id } });
        if (companyIds.length > 0) {
          await tx.userCompany.createMany({
            data: companyIds.map((cid: string) => ({
              userId: id,
              companyId: cid,
              createdBy: session.user.id,
            })),
          });
        }
      }
      return tx.user.update({
        where: { id },
        data: updateData,
        include: { role: true, companies: { include: { company: true } } },
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...safe } = user;
    return NextResponse.json(safe);
  } catch (err) {
    console.error("PATCH /api/admin/users/[id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (user.role.name === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: { name: "ADMIN" } } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot delete the last admin" }, { status: 400 });
      }
    }

    // Reassign ALL not-null FKs to the acting admin before deletion.
    // Relations with onDelete: Cascade or SetNull are handled automatically by Prisma/Postgres.
    const reassignedTo = session.user.id;
    await prisma.$transaction([
      // Projects
      prisma.project.updateMany({
        where: { managerId: id },
        data: { managerId: reassignedTo, updatedBy: reassignedTo },
      }),
      // Tasks
      prisma.task.updateMany({
        where: { assigneeId: id },
        data: { assigneeId: reassignedTo, updatedBy: reassignedTo },
      }),
      // Gaps
      prisma.gap.updateMany({
        where: { ownerId: id },
        data: { ownerId: reassignedTo, updatedBy: reassignedTo },
      }),
      // Gap actions
      prisma.gapAction.updateMany({
        where: { responsibleId: id },
        data: { responsibleId: reassignedTo, updatedBy: reassignedTo },
      }),
      // Maintenance windows (responsibleId NOT NULL — was the missing cause of the 500)
      prisma.iTMaintenance.updateMany({
        where: { responsibleId: id },
        data: { responsibleId: reassignedTo, updatedBy: reassignedTo },
      }),
      // Current-state assessments (assessedById NOT NULL)
      prisma.projectCurrentState.updateMany({
        where: { assessedById: id },
        data: { assessedById: reassignedTo, updatedBy: reassignedTo },
      }),
      // Comments (authorId NOT NULL)
      prisma.comment.updateMany({
        where: { authorId: id },
        data: { authorId: reassignedTo, updatedBy: reassignedTo },
      }),
      // Assets — nullable, set to null
      prisma.iTAsset.updateMany({
        where: { assignedToId: id },
        data: { assignedToId: null, updatedBy: reassignedTo },
      }),
      // Delete the user (cascades: UserCompany, ResourceAllocation, Notification, Account, Session)
      prisma.user.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/users/[id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
