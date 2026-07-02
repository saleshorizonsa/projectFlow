import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getPublicLogoUrl, getSupabaseAdmin, LOGOS_BUCKET } from "@/lib/supabase-admin";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

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
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check env vars before any Supabase call
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[logo] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
      return NextResponse.json({ error: "Storage not configured", detail: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment variables" }, { status: 500 });
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
      return NextResponse.json({ error: `File type "${file.type || "(empty)"}" not allowed. Use PNG, JPEG, WebP, SVG, or GIF` }, { status: 415 });
    }

    // Delete existing logo from storage
    if (company.logoUrl) {
      const existingPath = company.logoUrl.split(`/${LOGOS_BUCKET}/`)[1];
      if (existingPath) {
        const { error: removeErr } = await getSupabaseAdmin().storage.from(LOGOS_BUCKET).remove([existingPath]);
        if (removeErr) console.warn("[logo] remove old file:", removeErr.message);
      }
    }

    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : ".png";
    const storagePath = `company-${id}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    console.log(`[logo] uploading to bucket="${LOGOS_BUCKET}" path="${storagePath}" mime="${mimeType}" size=${buffer.length}`);

    const { data: uploadData, error: uploadError } = await getSupabaseAdmin()
      .storage
      .from(LOGOS_BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error("[logo] upload error:", JSON.stringify(uploadError));
      return NextResponse.json({ error: "Upload failed", detail: uploadError.message }, { status: 500 });
    }

    console.log("[logo] upload success:", uploadData);

    const logoUrl = getPublicLogoUrl(storagePath);
    await getPrisma().company.update({ where: { id }, data: { logoUrl } });

    return NextResponse.json({ logoUrl }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[logo] unhandled error:", msg);
    return NextResponse.json({ error: "Unexpected error", detail: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[logo] delete error:", msg);
    return NextResponse.json({ error: "Unexpected error", detail: msg }, { status: 500 });
  }
}
