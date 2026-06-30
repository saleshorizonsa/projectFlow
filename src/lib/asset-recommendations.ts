import { differenceInCalendarDays, differenceInYears } from "date-fns";

export type RecommendationSeverity = "critical" | "high" | "medium" | "low";

export type AssetRecommendation = {
  type: "REPLACE" | "PLAN_UPGRADE" | "MAINTENANCE_OVERDUE" | "MAINTENANCE_DUE" | "NO_MAINTENANCE" | "UNASSIGNED";
  label: string;
  detail: string;
  severity: RecommendationSeverity;
  action: string;
};

export type AssetForRec = {
  type: string;
  status: string;
  purchaseDate: Date;
  lifecycleYears: number;
  assignedToId?: string | null;
  employeeId?: string | null;
  maintenances?: { scheduledAt: Date; status: string }[];
};

function maintenanceIntervalDays(type: string): number {
  if (["ROUTER", "SWITCH", "FIREWALL"].includes(type)) return 90;
  if (["LAPTOP", "DESKTOP"].includes(type)) return 365;
  return 180; // servers, storage, applications, cloud — semi-annual
}

export function getAssetRecommendations(asset: AssetForRec): AssetRecommendation[] {
  if (asset.status === "RETIRED") return [];

  const recs: AssetRecommendation[] = [];
  const now = new Date();
  const ageYears = differenceInYears(now, asset.purchaseDate);

  // Lifecycle / replacement
  if (ageYears >= asset.lifecycleYears) {
    recs.push({
      type: "REPLACE",
      label: "Replace / Upgrade Now",
      detail: `Asset is ${ageYears}yr old — exceeds the ${asset.lifecycleYears}yr lifecycle.`,
      severity: "critical",
      action: "Initiate procurement and schedule migration to replacement asset.",
    });
  } else if (ageYears >= asset.lifecycleYears - 1) {
    recs.push({
      type: "PLAN_UPGRADE",
      label: "Plan Upgrade Budget",
      detail: `Reaches end-of-lifecycle in under 1 year (age: ${ageYears}yr / lifecycle: ${asset.lifecycleYears}yr).`,
      severity: "high",
      action: "Include replacement cost in next budget cycle.",
    });
  }

  // Unassigned custodian
  if (!asset.assignedToId && !asset.employeeId && asset.status === "ACTIVE" && asset.maintenances !== undefined) {
    recs.push({
      type: "UNASSIGNED",
      label: "No Custodian Assigned",
      detail: "Active asset has no system user or employee assigned.",
      severity: "medium",
      action: "Assign a responsible user or employee to ensure accountability.",
    });
  }

  // Maintenance history
  const completed = (asset.maintenances ?? [])
    .filter((m) => m.status === "COMPLETED")
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  const lastMaintenance = completed[0];
  const intervalDays = maintenanceIntervalDays(asset.type);

  if (!lastMaintenance && asset.status === "ACTIVE") {
    recs.push({
      type: "NO_MAINTENANCE",
      label: "No Maintenance Recorded",
      detail: "This active asset has no completed maintenance history.",
      severity: "medium",
      action: "Schedule an initial maintenance window to establish a baseline.",
    });
  } else if (lastMaintenance) {
    const daysSince = differenceInCalendarDays(now, lastMaintenance.scheduledAt);
    const overdueBy = daysSince - intervalDays;
    if (overdueBy > 0) {
      recs.push({
        type: "MAINTENANCE_OVERDUE",
        label: `Maintenance Overdue (${overdueBy}d)`,
        detail: `Last maintenance was ${daysSince}d ago. Recommended interval: ${intervalDays}d.`,
        severity: "high",
        action: "Schedule a maintenance window immediately.",
      });
    } else if (daysSince > intervalDays * 0.8) {
      const daysUntil = intervalDays - daysSince;
      recs.push({
        type: "MAINTENANCE_DUE",
        label: `Maintenance Due Soon (${daysUntil}d)`,
        detail: `Due in ${daysUntil}d. Last maintenance was ${daysSince}d ago.`,
        severity: "low",
        action: "Schedule maintenance window within the next 2 weeks.",
      });
    }
  }

  return recs;
}

export function topRecommendation(recs: AssetRecommendation[]): AssetRecommendation | null {
  if (recs.length === 0) return null;
  const order: RecommendationSeverity[] = ["critical", "high", "medium", "low"];
  return [...recs].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))[0];
}

export function severityVariant(severity: RecommendationSeverity) {
  const map: Record<RecommendationSeverity, "destructive" | "warning" | "secondary" | "outline"> = {
    critical: "destructive",
    high: "warning",
    medium: "secondary",
    low: "outline",
  };
  return map[severity];
}
