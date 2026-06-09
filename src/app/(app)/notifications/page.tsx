import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { syncDeadlineNotificationsForUser } from "@/lib/deadline-engine";
import { getPrisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/utils";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notification Center</h1>
          <p className="text-sm text-muted-foreground">In-app alerts for overdue tasks, gaps, missed milestones, and delayed projects.</p>
        </div>
        <Badge>{notifications.filter((notification) => !notification.readAt).length} unread</Badge>
      </div>
      {notifications.map((notification) => (
        <Card key={notification.id}>
          <CardHeader className="flex flex-row items-center gap-3">
            <Bell className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">{notification.title}</CardTitle>
            <Badge variant="outline">{formatEnum(notification.type)}</Badge>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{notification.message}</CardContent>
        </Card>
      ))}
    </div>
  );
}
