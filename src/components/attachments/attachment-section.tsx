"use client";

import { FileText, Paperclip, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  url: string | null;
};

type EntityType = "project" | "task" | "gap" | "supportTicket";

function entityParam(type: EntityType) {
  if (type === "supportTicket") return "supportTicketId";
  return `${type}Id`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return "🖼";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  return "📎";
}

export function AttachmentSection({
  entityType,
  entityId,
  canDelete = false,
}: {
  entityType: EntityType;
  entityId: string;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();

  const param = entityParam(entityType);

  const loadAttachments = useCallback(() => {
    fetch(`/api/attachments?${param}=${entityId}`)
      .then((r) => r.json())
      .then((data: Attachment[]) => { setAttachments(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [entityId, param]);

  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  async function uploadFile(file: File) {
    setError(null);
    setUploading(true);
    setUploadProgress(`Uploading ${file.name}…`);

    const form = new FormData();
    form.append("file", file);
    form.append(param, entityId);

    try {
      const res = await fetch("/api/attachments", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Upload failed.");
        return;
      }
      const created: Attachment = await res.json();
      setAttachments((prev) => [created, ...prev]);
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function deleteAttachment(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      if (!res.ok) { setError("Delete failed."); return; }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Paperclip className="h-4 w-4" />
        Attachments {attachments.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{attachments.length}</span>}
      </div>

      {/* Drop zone */}
      <div
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input ref={fileRef} type="file" className="sr-only" onChange={onFileChange} />
        {uploading ? (
          <>
            <Upload className="h-5 w-5 animate-bounce text-primary" />
            <p className="text-xs text-muted-foreground">{uploadProgress}</p>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Click or drag a file here to upload (max 20 MB)</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <X className="h-3 w-3 shrink-0" />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* Attachment list */}
      {!loaded && <p className="text-xs text-muted-foreground">Loading attachments…</p>}

      {loaded && attachments.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2">
                <span className="text-lg leading-none">{fileIcon(a.mimeType)}</span>
                <div className="min-w-0 flex-1">
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {a.fileName}
                    </a>
                  ) : (
                    <span className="truncate text-sm font-medium text-muted-foreground">{a.fileName}</span>
                  )}
                  <div className="text-xs text-muted-foreground">{formatBytes(a.size)} · {new Date(a.createdAt).toLocaleDateString()}</div>
                </div>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteAttachment(a.id)}
                    disabled={pending}
                    aria-label="Delete attachment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {loaded && attachments.length === 0 && (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      )}
    </div>
  );
}
