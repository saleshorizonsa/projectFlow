import type { GapSeverity } from "@prisma/client";

export const gapImpactBySeverity: Record<GapSeverity, string> = {
  LOW: "Minor impact. Work can continue with limited monitoring.",
  MEDIUM: "Moderate impact. Delivery may slip without timely corrective action.",
  HIGH: "High impact. Project timeline, cost, quality, or accountability is at risk.",
  CRITICAL: "Critical impact. Delivery is blocked or a major deadline/client commitment is at immediate risk.",
};

export function calculateGapImpact(severity: GapSeverity | string | undefined) {
  return gapImpactBySeverity[severity as GapSeverity] ?? gapImpactBySeverity.MEDIUM;
}
