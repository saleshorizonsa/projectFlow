"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type CommentAuthor = { id: string; name: string; image: string | null };
type Comment = { id: string; body: string; createdAt: string; author: CommentAuthor };
type EntityType = "project" | "task" | "gap" | "supportTicket";

function entityParam(type: EntityType): string {
  if (type === "supportTicket") return "supportTicketId";
  return `${type}Id`;
}

export function CommentSection({
  entityType,
  entityId,
  currentUserId,
  currentUserRole,
  initialComments,
}: {
  entityType: EntityType;
  entityId: string;
  currentUserId: string;
  currentUserRole: string;
  initialComments?: Comment[];
}) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>(initialComments ?? []);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(Boolean(initialComments));

  useEffect(() => {
    if (loaded) return;
    const param = entityParam(entityType);
    fetch(`/api/comments?${param}=${entityId}`)
      .then((res) => res.json())
      .then((data: Comment[]) => { setComments(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [entityId, entityType, loaded]);

  function submit() {
    if (!body.trim()) return;
    setError(null);
    const param = entityParam(entityType);
    startTransition(async () => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), [param]: entityId }),
      });
      if (!res.ok) {
        setError("Comment could not be posted.");
        return;
      }
      const created: Comment = await res.json();
      setComments((prev) => [...prev, created]);
      setBody("");
      router.refresh();
    });
  }

  function deleteComment(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (!res.ok) { setError("Delete failed."); return; }
      setComments((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        Comments {comments.length > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{comments.length}</span>}
      </div>

      {comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px]">{comment.author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 rounded-md border bg-muted/30 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-medium">{comment.author.name}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</span>
                    {(comment.author.id === currentUserId || currentUserRole === "ADMIN") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteComment(comment.id)}
                        disabled={pending}
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loaded && <p className="text-xs text-muted-foreground">Loading comments…</p>}
      {loaded && comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet. Be the first to comment.</p>}

      <Separator />

      <div className="space-y-2">
        <Textarea
          placeholder="Write a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
          rows={3}
          className="resize-none"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Ctrl+Enter to submit</span>
          <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
            {pending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
