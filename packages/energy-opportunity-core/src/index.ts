export type ResourceKind = 'asic' | 'gpu' | 'cpu' | 'cloud';
export type AuthorizationMode = 'disabled' | 'observe' | 'execute';
export type WorkloadKind = 'bitcoin-mining' | 'ai-compute' | 'other';
export type Decision = 'start' | 'stop' | 'observe' | 'deny';

export interface Resource {
  resourceId: string;
  kind: ResourceKind;
  authorization: AuthorizationMode;
  powerLimitWatts: number;
}

export interface WorkloadEstimate {
  workloadId: string;
  kind: WorkloadKind;
  revenuePerHour: number;
  electricityCostPerHour: number;
  providerFeesPerHour: number;
  confidence: number;
}

export interface PolicyLimits {
  minimumNetPerHour: number;
  maxPowerWatts: number;
  minConfidence: number;
}

export interface OpportunityDecision {
  decision: Decision;
  expectedNetPerHour: number;
  reasonCodes: string[];
}

export function expectedNetPerHour(estimate: WorkloadEstimate): number {
  return estimate.revenuePerHour - estimate.electricityCostPerHour - estimate.providerFeesPerHour;
}

export function decideMining(
  resource: Resource,
  estimate: WorkloadEstimate,
  limits: PolicyLimits,
): OpportunityDecision {
  const net = expectedNetPerHour(estimate);
  const reasons: string[] = [];

  if (resource.authorization === 'disabled') {
    return { decision: 'deny', expectedNetPerHour: net, reasonCodes: ['RESOURCE_NOT_AUTHORIZED'] };
  }
  if (resource.kind !== 'asic') reasons.push('NON_ASIC_RESOURCE');
  if (resource.powerLimitWatts > limits.maxPowerWatts) {
    return { decision: 'deny', expectedNetPerHour: net, reasonCodes: ['POWER_LIMIT_EXCEEDED'] };
  }
  if (estimate.confidence < limits.minConfidence) {
    return { decision: 'observe', expectedNetPerHour: net, reasonCodes: ['LOW_CONFIDENCE'] };
  }
  if (net < limits.minimumNetPerHour) {
    return { decision: 'stop', expectedNetPerHour: net, reasonCodes: ['UNPROFITABLE'] };
  }
  if (resource.authorization === 'observe') {
    return { decision: 'observe', expectedNetPerHour: net, reasonCodes: ['OBSERVE_ONLY'] };
  }
  if (estimate.kind !== 'bitcoin-mining') {
    return { decision: 'deny', expectedNetPerHour: net, reasonCodes: ['WORKLOAD_NOT_MINING'] };
  }
  return { decision: 'start', expectedNetPerHour: net, reasonCodes: reasons };
}

export { planCpuminerDryRun } from './cpuminer.ts';
export type { CpuminerConfig, CpuminerDryRun } from './cpuminer.ts';
export { readBitaxeTelemetry, createFetchBitaxeClient } from './bitaxe.ts';
export type { BitaxeTelemetry, BitaxeHttpClient, BitaxeAdapterConfig } from './bitaxe.ts';
export { projectMiningEconomics, isVerifiedMiningPayout } from './moneycore-bridge.ts';
export type { MiningMoneyProjection, MiningMoneyProjectionInput, RealizedMiningPayout } from './moneycore-bridge.ts';
export { verifyMiningPayout } from './bitcoin-core.ts';
export type { BitcoinCoreReadClient, BitcoinCoreTransaction, BitcoinCoreVout, VerifyMiningPayoutInput, VerifiedBitcoinPayout } from './bitcoin-core.ts';
export { electricityExpenseUsd, isGovernedMiningFinancialEvent } from './financial-events.ts';
export type { MiningFinancialEvent, MiningFinancialEventKind, MiningFinancialEventBase, MiningEconomicsProjectedEvent, ElectricityExpenseObservedEvent, MiningPayoutVerifiedEvent, MiningProfitabilitySnapshotEvent } from './financial-events.ts';
export { buildMiningProfitabilityDashboard } from './profitability-dashboard.ts';
export type { MiningProfitabilityDashboard } from './profitability-dashboard.ts';
export type { MiningDecision, MiningDecisionInput, MiningDecisionRecord } from './economic-decision.ts';
export { evaluateMiningOpportunity } from './economic-decision.ts';
export type { MiningDecisionLedger } from './decision-ledger.ts';
export { InMemoryMiningDecisionLedger } from './decision-ledger.ts';
export { SupabaseMiningDecisionLedger } from './supabase-decision-ledger.ts';
export type { SupabaseDecisionLedgerConfig } from './supabase-decision-ledger.ts';
export { buildMiningCommandCenterCard } from './command-center.ts';
export type { CommandCenterDecision, MiningCommandCenterCard } from './command-center.ts';
