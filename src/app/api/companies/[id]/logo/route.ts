import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { ensureLogosBucket, getPublicLogoUrl, getSupabaseAdmin, LOGOS_BUCKET } from "@/lib/supabase-admin";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// Derive MIME type from extension when browser doesn't send Content-Type
const EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};
const ALLOWED_TYPES = new Set(Object.values(EXT_MIME));

function resolveMime(file: File): string | null {
  if (file.type && ALLOWED_TYPES.has(file.type)) return file.type;
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
  return EXT_MIME[ext] ?? null;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const company = await getPrisma().company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file || !file.size) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Logo must be under 2 MB" }, { status: 413 });

  const mimeType = resolveMime(file);
  if (!mimeType) {
    return NextResponse.json({ error: "Only PNG, JPEG, WebP, SVG, or GIF allowed" }, { status: 415 });
  }

  // Ensure bucket exists (public so logos render without signed URLs)
  const bucketResult = await ensureLogosBucket();
  if (bucketResult?.error) {
    console.error("[logo] bucket error:", bucketResult.error);
    return NextResponse.json({ error: "Storage bucket unavailable", detail: bucketResult.error }, { status: 500 });
  }

  // Delete existing logo file from storage if present
  if (company.logoUrl) {
    const existingPath = company.logoUrl.split(`/${LOGOS_BUCKET}/`)[1];
    if (existingPath) {
      await getSupabaseAdmin().storage.from(LOGOS_BUCKET).remove([existingPath]);
    }
  }

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : ".png";
  const storagePath = `company-${id}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await getSupabaseAdmin()
    .storage
    .from(LOGOS_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    console.error("[logo] upload error:", uploadError);
    return NextResponse.json({ error: "Upload failed", detail: uploadError.message }, { status: 500 });
  }

  const logoUrl = getPublicLogoUrl(storagePath);
  await getPrisma().company.update({ where: { id }, data: { logoUrl } });

  return NextResponse.json({ logoUrl }, { status: 200 });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const company = await getPrisma().company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  if (company.logoUrl) {
    const existingPath = company.logoUrl.split(`/${LOGOS_BUCKET}/`)[1];
    if (existingPath) {
      await getSupabaseAdmin().storage.from(LOGOS_BUCKET).remove([existingPath]);
    }
  }

  await getPrisma().company.update({ where: { id }, data: { logoUrl: null } });
  return NextResponse.json({ ok: true });
}
