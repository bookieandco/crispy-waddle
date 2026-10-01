export interface OpportunityAttribution {
  opportunityId: string;
  discoverySources: AttributionSource[];
  researchSources: AttributionSource[];
  actions: AttributionAction[];
  executions: AttributionExecution[];
  transactions: AttributionTransaction[];
  outcome?: OpportunityOutcome;
}

export interface AttributionSource {
  sourceId: string;
  provider: string;
  role: "discovery" | "research";
  observedAt: string;
}

export interface AttributionAction {
  actionId: string;
  type: string;
  occurredAt: string;
  status: string;
}

export interface AttributionExecution {
  executionId: string;
  actionId: string;
  provider: string;
  occurredAt: string;
  status: "started" | "completed" | "failed" | "cancelled";
}

export interface AttributionTransaction {
  transactionId: string;
  executionId?: string;
  occurredAt: string;
  currency: string;
  revenue?: number;
  cost?: number;
  externalReference?: string;
}

export interface OpportunityOutcome {
  currency: string;
  realizedRevenue: number;
  realizedCost: number;
  realizedContribution: number;
  measuredAt: string;
}
