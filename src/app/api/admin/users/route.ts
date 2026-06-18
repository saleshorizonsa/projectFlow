import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, email, password, roleId, companyIds = [] } = body;

    if (!name?.trim() || !email?.trim() || !password?.trim() || !roleId) {
      return NextResponse.json(
        { error: "name, email, password, roleId are required" },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (password.trim().length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        roleId,
        createdBy: session.user.id,
        companies:
          companyIds.length > 0
            ? { create: companyIds.map((id: string) => ({ companyId: id, createdBy: session.user.id })) }
            : undefined,
      },
      include: { role: true, companies: { include: { company: true } } },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...safe } = user;
    return NextResponse.json(safe, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/users", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
