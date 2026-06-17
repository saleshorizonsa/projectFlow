import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { ensureBucket, getSignedUrl, getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase-admin";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const taskId = searchParams.get("taskId") ?? undefined;
  const gapId = searchParams.get("gapId") ?? undefined;
  const supportTicketId = searchParams.get("supportTicketId") ?? undefined;

  if (!projectId && !taskId && !gapId && !supportTicketId) {
    return NextResponse.json({ error: "Provide at least one entity filter" }, { status: 400 });
  }

  const attachments = await getPrisma().attachment.findMany({
    where: { projectId, taskId, gapId, supportTicketId },
    orderBy: { createdAt: "desc" },
  });

  const withUrls = await Promise.all(
    attachments.map(async (a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt.toISOString(),
      url: await getSignedUrl(a.fileUrl),
    })),
  );

  return NextResponse.json(withUrls);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file || !file.size) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 413 });

  const projectId = (formData.get("projectId") as string) || undefined;
  const taskId = (formData.get("taskId") as string) || undefined;
  const gapId = (formData.get("gapId") as string) || undefined;
  const supportTicketId = (formData.get("supportTicketId") as string) || undefined;

  if (!projectId && !taskId && !gapId && !supportTicketId) {
    return NextResponse.json({ error: "Provide at least one entity reference" }, { status: 400 });
  }

  await ensureBucket();

  const entityFolder = projectId ? `project/${projectId}`
    : taskId ? `task/${taskId}`
    : gapId ? `gap/${gapId}`
    : `ticket/${supportTicketId}`;

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const storagePath = `${entityFolder}/${randomUUID()}${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await getSupabaseAdmin()
    .storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "Storage upload failed", detail: uploadError.message }, { status: 500 });
  }

  const attachment = await getPrisma().attachment.create({
    data: {
      fileName: file.name,
      fileUrl: storagePath,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      projectId,
      taskId,
      gapId,
      supportTicketId,
    },
  });

  const url = await getSignedUrl(storagePath);
  return NextResponse.json({ ...attachment, url }, { status: 201 });
}
