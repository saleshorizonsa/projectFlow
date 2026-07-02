import { createClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = "projectflow-attachments";
export const LOGOS_BUCKET = "projectflow-logos";

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return _client;
}

export async function ensureBucket() {
  const supabase = getSupabaseAdmin();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === STORAGE_BUCKET)) {
    await supabase.storage.createBucket(STORAGE_BUCKET, { public: false });
  }
}

export async function ensureLogosBucket(): Promise<{ error: string } | null> {
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) return { error: listError.message };
  if (!buckets?.find((b) => b.name === LOGOS_BUCKET)) {
    const { error: createError } = await supabase.storage.createBucket(LOGOS_BUCKET, { public: true });
    if (createError) return { error: createError.message };
  }
  return null;
}

export function getPublicLogoUrl(path: string) {
  const base = process.env.SUPABASE_URL!.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${LOGOS_BUCKET}/${path}`;
}

export async function getSignedUrl(path: string, expiresIn = 3600) {
  const { data, error } = await getSupabaseAdmin()
    .storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}
