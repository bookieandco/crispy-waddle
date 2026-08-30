export const OPPORTUNITY_RISK_CATEGORIES = [
  "ip",
  "platform",
  "supplier",
  "fulfillment",
  "capital",
  "legal",
  "fraud",
  "data",
  "reputation",
  "dependency",
  "automation",
] as const;

export type OpportunityRiskCategory =
  (typeof OPPORTUNITY_RISK_CATEGORIES)[number];

export type OpportunityRiskSeverity = "low" | "medium" | "high" | "critical";

export interface OpportunityRisk {
  category: OpportunityRiskCategory;
  severity: OpportunityRiskSeverity;
  probability?: number;
  evidenceIds?: string[];
  mitigation?: string;
  disposition?: "accept" | "mitigate" | "block";
}
