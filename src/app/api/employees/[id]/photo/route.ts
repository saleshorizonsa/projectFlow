import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getPublicLogoUrl, getSupabaseAdmin, LOGOS_BUCKET } from "@/lib/supabase-admin";

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB

const EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};
const ALLOWED_TYPES = new Set(Object.values(EXT_MIME));

function resolveMime(file: File): string | null {
  if (file.type && ALLOWED_TYPES.has(file.type)) return file.type;
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
  return EXT_MIME[ext] ?? null;
}

function hasSupabaseStorage() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const employee = await getPrisma().employee.findUnique({ where: { id } });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const formData = await request.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

    const file = formData.get("file") as File | null;
    if (!file || !file.size) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo must be under 3 MB" }, { status: 413 });

    const mimeType = resolveMime(file);
    if (!mimeType) {
      return NextResponse.json({ error: "Only PNG, JPEG, or WebP images are allowed" }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let photoUrl: string;

    if (hasSupabaseStorage()) {
      if (employee.photoUrl && employee.photoUrl.startsWith("http")) {
        const existingPath = employee.photoUrl.split(`/${LOGOS_BUCKET}/`)[1];
        if (existingPath) await getSupabaseAdmin().storage.from(LOGOS_BUCKET).remove([existingPath]);
      }
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : ".jpg";
      const storagePath = `employee-${id}${ext}`;
      const { error: uploadError } = await getSupabaseAdmin()
        .storage.from(LOGOS_BUCKET)
        .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
      if (uploadError) return NextResponse.json({ error: "Upload failed", detail: uploadError.message }, { status: 500 });
      photoUrl = getPublicLogoUrl(storagePath);
    } else {
      photoUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    }

    await getPrisma().employee.update({ where: { id }, data: { photoUrl } });
    return NextResponse.json({ photoUrl }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Unexpected error", detail: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const employee = await getPrisma().employee.findUnique({ where: { id } });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    if (employee.photoUrl && employee.photoUrl.startsWith("http") && hasSupabaseStorage()) {
      const existingPath = employee.photoUrl.split(`/${LOGOS_BUCKET}/`)[1];
      if (existingPath) await getSupabaseAdmin().storage.from(LOGOS_BUCKET).remove([existingPath]);
    }

    await getPrisma().employee.update({ where: { id }, data: { photoUrl: null } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Unexpected error", detail: msg }, { status: 500 });
  }
}
