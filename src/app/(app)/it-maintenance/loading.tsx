import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ITMaintenanceLoading() {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex min-h-20 items-center justify-between gap-3 p-3">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-10" />
              </div>
              <Skeleton className="h-9 w-9 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-14 rounded-md" />
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
