import { addHours } from "date-fns";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const slaHours: Record<Priority, { response: number; resolution: number }> = {
  LOW: { response: 8, resolution: 72 },
  MEDIUM: { response: 4, resolution: 48 },
  HIGH: { response: 2, resolution: 24 },
  CRITICAL: { response: 1, resolution: 8 },
};

export function calculateSla(priority: Priority, from = new Date()) {
  const policy = slaHours[priority];
  return {
    firstResponseDueAt: addHours(from, policy.response),
    resolveDueAt: addHours(from, policy.resolution),
    responseHours: policy.response,
    resolutionHours: policy.resolution,
  };
}

export function slaPolicyLabel(priority: Priority) {
  const policy = slaHours[priority];
  return `${policy.response}h response / ${policy.resolution}h resolution`;
}
