import { differenceInCalendarDays, differenceInYears } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AssetTableRow } from "@/components/it-maintenance/it-maintenance-tables";

type LifecycleStatus = "retired" | "eol" | "near-eol" | "warranty-expiring" | "healthy";

function getLifecycleStatus(asset: AssetTableRow, now: Date): LifecycleStatus {
  if (asset.status === "RETIRED") return "retired";
  const age = differenceInYears(now, new Date(asset.purchaseDate));
  if (age >= asset.lifecycleYears) return "eol";
  if (age >= asset.lifecycleYears - 1) return "near-eol";
  if (asset.warrantyExpiry) {
    const daysLeft = differenceInCalendarDays(new Date(asset.warrantyExpiry), now);
    if (daysLeft <= 90) return "warranty-expiring";
  }
  return "healthy";
}

const STATUS_META: Record<LifecycleStatus, { label: string; variant: "destructive" | "warning" | "secondary" | "success" }> = {
  "retired":            { label: "Retired",           variant: "secondary" },
  "eol":                { label: "End of Life",        variant: "destructive" },
  "near-eol":           { label: "Near EOL",           variant: "warning" },
  "warranty-expiring":  { label: "Warranty Expiring",  variant: "warning" },
  "healthy":            { label: "Healthy",            variant: "success" },
};

const STATUS_ORDER: LifecycleStatus[] = ["eol", "near-eol", "warranty-expiring", "retired", "healthy"];

export function AssetLifecycleTab({ assets }: { assets: AssetTableRow[] }) {
  const now = new Date();

  const rows = assets
    .map(a => ({ asset: a, status: getLifecycleStatus(a, now) }))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const counts = {
    eol: rows.filter(r => r.status === "eol").length,
    nearEol: rows.filter(r => r.status === "near-eol").length,
    warrantyExpiring: rows.filter(r => r.status === "warranty-expiring").length,
    healthy: rows.filter(r => r.status === "healthy").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{counts.eol}</p>
            <p className="mt-1 text-xs text-muted-foreground">End of Life</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-orange-500">{counts.nearEol}</p>
            <p className="mt-1 text-xs text-muted-foreground">Near EOL (&lt; 1 yr)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{counts.warrantyExpiring}</p>
            <p className="mt-1 text-xs text-muted-foreground">Warranty Expiring</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{counts.healthy}</p>
            <p className="mt-1 text-xs text-muted-foreground">Healthy</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Lifecycle Dashboard</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto rounded-b-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Lifecycle</TableHead>
                  <TableHead>EOL Date</TableHead>
                  <TableHead>Warranty Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lifecycle Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ asset, status }) => {
                  const age = differenceInYears(now, new Date(asset.purchaseDate));
                  const eolDate = new Date(asset.purchaseDate);
                  eolDate.setFullYear(eolDate.getFullYear() + asset.lifecycleYears);
                  const daysToEol = differenceInCalendarDays(eolDate, now);
                  const warrantyDaysLeft = asset.warrantyExpiry
                    ? differenceInCalendarDays(new Date(asset.warrantyExpiry), now)
                    : null;
                  const meta = STATUS_META[status];

                  return (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{asset.assetTag} / {asset.name}</div>
                        <div className="text-xs text-muted-foreground">{asset.vendor} / {asset.model}</div>
                      </TableCell>
                      <TableCell className="text-sm">{age} yr</TableCell>
                      <TableCell className="text-sm">{asset.lifecycleYears} yr</TableCell>
                      <TableCell>
                        <div className="text-sm">{eolDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                        {daysToEol < 0 ? (
                          <div className="text-xs text-destructive">{Math.abs(daysToEol)} days overdue</div>
                        ) : daysToEol <= 365 ? (
                          <div className="text-xs text-orange-500">{daysToEol} days left</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {asset.warrantyExpiry ? (
                          <>
                            <div className="text-sm">{new Date(asset.warrantyExpiry).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                            {warrantyDaysLeft !== null && warrantyDaysLeft < 0 ? (
                              <div className="text-xs text-destructive">Expired {Math.abs(warrantyDaysLeft)} days ago</div>
                            ) : warrantyDaysLeft !== null && warrantyDaysLeft <= 90 ? (
                              <div className="text-xs text-yellow-600">{warrantyDaysLeft} days left</div>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={asset.status === "ACTIVE" ? "success" : "secondary"}>{asset.status.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No assets found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
