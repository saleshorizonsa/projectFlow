import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 xl:grid-cols-[1.15fr_2fr]">
        <Card className="overflow-hidden">
          <CardContent className="flex h-full flex-col justify-between gap-5 p-5">
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-md" />)}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex min-h-20 items-center justify-between gap-3 p-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-12" />
                </div>
                <Skeleton className="h-9 w-9 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-3">
        {[0, 1].map((i) => (
          <Card key={i} className={i === 0 ? "xl:col-span-2" : ""}>
            <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-16 rounded-md" />
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
