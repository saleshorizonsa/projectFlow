import { Bell, CheckCheck, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { syncDeadlineNotificationsForUser } from "@/lib/deadline-engine";
import { getPrisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/utils";
import { markOneRead, markAllRead } from "./actions";

function timeAgo(date: Date) {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default async function NotificationsPage() {
  const session = await auth();
  const prisma = getPrisma();
  if (session?.user.id) {
    await syncDeadlineNotificationsForUser(session.user.id, prisma);
  }
  const notifications = await prisma.notification.findMany({
    where: { userId: session?.user.id },
    orderBy: { createdAt: "desc" },
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notification Center</h1>
          <p className="text-sm text-muted-foreground">
            In-app alerts for overdue tasks, gaps, missed milestones, and delayed projects.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 ? (
            <Badge variant="destructive">{unreadCount} unread</Badge>
          ) : notifications.length > 0 ? (
            <Badge variant="secondary">All caught up</Badge>
          ) : null}
          {unreadCount > 0 && (
            <form action={markAllRead}>
              <Button type="submit" variant="outline" size="sm">
                <CheckCheck className="mr-1 h-4 w-4" />
                Mark all read
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {notifications.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Bell className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-base font-medium">No notifications yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Alerts appear here when tasks are overdue, milestones are missed, or gaps pass their target closure date.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── List ── */}
      <div className="space-y-2">
        {notifications.map((n) => {
          const isUnread = !n.readAt;
          return (
            <Card
              key={n.id}
              className={isUnread ? "border-l-4 border-l-primary bg-primary/[0.03]" : "opacity-70"}
            >
              <CardHeader className="flex flex-row items-start gap-3 pb-2">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isUnread ? "bg-primary/10" : "bg-muted"}`}>
                  <Bell className={`h-3.5 w-3.5 ${isUnread ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className={`text-sm ${isUnread ? "" : "text-muted-foreground"}`}>
                      {n.title}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">{formatEnum(n.type)}</Badge>
                    {isUnread && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {timeAgo(new Date(n.createdAt))}
                    {n.readAt && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-muted-foreground/60">
                        <Check className="h-3 w-3" /> Read
                      </span>
                    )}
                  </p>
                </div>
                {isUnread && (
                  <form action={markOneRead.bind(null, n.id)}>
                    <Button type="submit" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs">
                      <Check className="mr-1 h-3 w-3" /> Mark read
                    </Button>
                  </form>
                )}
              </CardHeader>
              <CardContent className="pb-3 pl-10">
                <p className="text-sm text-muted-foreground">{n.message}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
