import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase-admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role as string;
  if (!["ADMIN", "PROJECT_MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const attachment = await getPrisma().attachment.findUnique({ where: { id } });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error: storageError } = await getSupabaseAdmin()
    .storage
    .from(STORAGE_BUCKET)
    .remove([attachment.fileUrl]);

  if (storageError) {
    return NextResponse.json({ error: "Storage delete failed", detail: storageError.message }, { status: 500 });
  }

  await getPrisma().attachment.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
