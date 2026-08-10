export type ActorType = "customer" | "staff" | "system" | "agent";
export type DataClassification = "public" | "operational" | "sensitive" | "restricted";
export type RecommendationType =
  | "observation"
  | "forecast"
  | "optimization"
  | "compliance_alert"
  | "research_finding"
  | "action_proposal";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ApprovalLevel = "auto" | "review" | "high_risk" | "blocked";

export interface IntelligenceEvent<TPayload = unknown> {
  eventId: string;
  eventType: string;
  eventVersion: string;
  occurredAt: string;
  observedAt: string;
  tenantId: string;
  jurisdictionId?: string;
  aggregateType: string;
  aggregateId: string;
  actor: {
    type: ActorType;
    id?: string;
    role?: string | null;
  };
  correlationId: string;
  causationId?: string;
  dataClassification: DataClassification;
  payload: TPayload;
  source: {
    system: string;
    service: string;
    version: string;
  };
}

export interface EvidenceReference {
  evidenceId: string;
  sourceType: string;
  sourceId: string;
  title?: string;
  version?: string;
  observedAt?: string;
  uri?: string;
  excerpt?: string;
}

export interface ContextPacket<T = unknown> {
  contextId: string;
  contractVersion: "JIC-1.0";
  mission: string;
  objective: string;
  tenantId: string;
  jurisdiction?: {
    id: string;
    policyVersion?: string;
  };
  generatedAt: string;
  expiresAt?: string;
  constraints: string[];
  evidence: EvidenceReference[];
  data: T;
}

export interface Recommendation {
  recommendationId: string;
  contractVersion: "JIC-1.0";
  type: RecommendationType;
  title: string;
  summary: string;
  rationale: string[];
  evidence: EvidenceReference[];
  confidence: number;
  impact?: {
    metric: string;
    estimatedChange: number;
    unit: string;
  };
  constraints: string[];
  risk: {
    level: RiskLevel;
    factors: string[];
  };
  approval: {
    level: ApprovalLevel;
    required: boolean;
    reason?: string;
  };
  proposedCommand?: CommandProposal;
  createdAt: string;
  expiresAt?: string;
}

export interface CommandProposal {
  commandId: string;
  commandType: string;
  targetType: string;
  targetId: string;
  parameters: Record<string, unknown>;
  requestedBy: "jhadina";
  recommendationId: string;
  policyRequirements: string[];
}

export interface ApprovalDecision {
  approvalId: string;
  recommendationId: string;
  decision: "approved" | "rejected" | "expired";
  actorId: string;
  reason?: string;
  decidedAt: string;
}

export interface CommandResult {
  commandId: string;
  status: "accepted" | "rejected" | "completed" | "failed";
  reason?: string;
  resultingEventIds: string[];
  completedAt?: string;
}

export const JIC_VERSION = "JIC-1.0" as const;

export const INTELLIGENCE_EVENT_TYPES = [
  "ORDER_CREATED",
  "ORDER_AUTHORIZED",
  "ORDER_BLOCKED",
  "ORDER_CANCELLED",
  "ORDER_COMPLETED",
  "INVENTORY_RECEIVED",
  "INVENTORY_RESERVED",
  "INVENTORY_RELEASED",
  "INVENTORY_LOW",
  "INVENTORY_ADJUSTED",
  "INVENTORY_DISCREPANCY",
  "PICK_STARTED",
  "PICK_COMPLETED",
  "MANIFEST_CREATED",
  "MERCHANT_HANDOFF",
  "COURIER_PICKUP",
  "DELIVERY_STARTED",
  "DELIVERY_COMPLETED",
  "DELIVERY_FAILED",
  "COURIER_ASSIGNED",
  "COURIER_DELAYED",
  "ROUTE_STARTED",
  "ROUTE_DEVIATION",
  "VEHICLE_EXCEPTION",
  "POLICY_CHECKED",
  "POLICY_ALLOWED",
  "POLICY_DENIED",
  "VERIFICATION_FAILED",
  "COMPLIANCE_EXCEPTION",
  "REGULATION_CHANGED",
  "POLICY_VERSION_PUBLISHED",
  "POLICY_VERSION_RETIRED",
  "JURISDICTION_RULE_CHANGED"
] as const;

export type IntelligenceEventType = (typeof INTELLIGENCE_EVENT_TYPES)[number];

export function isConfidenceValid(confidence: number): boolean {
  return Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;
}

export function canExecuteRecommendation(recommendation: Recommendation): boolean {
  return (
    recommendation.approval.level !== "blocked" &&
    (!recommendation.approval.required || recommendation.approval.level === "auto") &&
    isConfidenceValid(recommendation.confidence)
  );
}
