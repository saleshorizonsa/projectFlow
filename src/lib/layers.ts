export const layerDefinitions = {
  PLANNING: [
    "Scope Definition",
    "Requirements",
    "Work Breakdown Structure",
    "Milestones",
    "Risk Assessment",
    "Gap Analysis",
  ],
  PREPARATION: [
    "Resource Allocation",
    "Team Assignment",
    "Environment Setup",
    "Procurement",
    "Documentation",
    "Readiness Review",
  ],
  IMPLEMENTATION: [
    "Development",
    "Testing",
    "Deployment",
    "Monitoring",
    "Issue Resolution",
    "Closure",
  ],
} as const;

export type LayerKey = keyof typeof layerDefinitions;
