import { createHash } from 'node:crypto'
import type { AssetClass } from './financial-intelligence-contracts.js'
import type { OpportunityCandidateV2 } from './cross-asset-fusion-contracts.js'

export type ExactAmount=Readonly<{minor:bigint;currency:string}>
export type PortfolioHolding=Readonly<{instrumentId:string;assetClass:AssetClass;marketValue:ExactAmount;liquidValue:ExactAmount;clusterIds:readonly string[];evidenceIds:readonly string[]}>
export type PortfolioConstructionSnapshot=Readonly<{snapshotId:string;accountId:string;currency:string;cash:ExactAmount;reservedCash:ExactAmount;holdings:readonly PortfolioHolding[];informationCutoff:string;stateHash:string;evidenceIds:readonly string[]}>
export type AllocationConstraint=Readonly<{constraintId:string;kind:'MAX_POSITION_BPS'|'MAX_ASSET_CLASS_BPS'|'MAX_CLUSTER_BPS'|'MIN_CASH_RESERVE_BPS'|'MAX_TURNOVER_BPS'|'MAX_OPPORTUNITY_BPS'|'NO_SHORT'|'NO_LEVERAGE';limitBps?:number;subject?:string;policyVersion:string}>
export type PortfolioObjective=Readonly<{objectiveId:string;kind:'RISK_ADJUSTED_RETURN'|'CAPITAL_PRESERVATION'|'DIVERSIFICATION'|'LIQUIDITY';weightBps:number;methodologyVersion:string}>
export type TargetAllocation=Readonly<{instrumentId:string;assetClass:AssetClass;opportunityId:string;targetBps:number;targetValue:ExactAmount;confidenceBps:number;clusterIds:readonly string[];evidenceIds:readonly string[]}>
export type PortfolioConstructionPlan=Readonly<{planId:string;snapshotId:string;targets:readonly TargetAllocation[];cashTargetBps:number;turnoverBps:number;constraintIds:readonly string[];objectiveIds:readonly string[];informationCutoff:string;expiresAt:string;inputHash:string;provenanceHash:string;authority:'ANALYSIS_ONLY'}>
export type RebalanceIntent=Readonly<{intentId:string;planId:string;instrumentId:string;side:'BUY'|'SELL'|'HOLD';notional:ExactAmount;reasonCodes:readonly string[];authority:'NONE'}>
export type PaperPortfolioRun=Readonly<{runId:string;planId:string;startingValue:ExactAmount;endingValue:ExactAmount;fees:ExactAmount;slippage:ExactAmount;startedAt:string;endedAt:string;evidenceIds:readonly string[];provenanceHash:string;authority:'PAPER_ONLY'}>
export type AllocationCalibration=Readonly<{calibrationId:string;planId:string;paperRunId:string;returnBps:number;drawdownBps:number;turnoverBps:number;constraintBreaches:number;createdAt:string;authority:'LEARNING_ONLY'}>
export type PortfolioReplayManifest=Readonly<{replayId:string;informationCutoff:string;snapshotId:string;opportunityIds:readonly string[];planId:string;excludedFutureOpportunityIds:readonly string[];inputHash:string;provenanceHash:string;authority:'RESEARCH_ONLY'}>

export function hash040(v:unknown){return createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')}
export function assertBps(x:number,label='bps'){if(!Number.isInteger(x)||x<0||x>10000)throw new Error(`MONEY_040_${label.toUpperCase()}_INVALID`)}
export function assertExactAmount(x:ExactAmount,currency?:string){if(x.minor<0n||!x.currency||currency&&x.currency!==currency)throw new Error('MONEY_040_EXACT_AMOUNT_INVALID')}
export function assertPortfolioOpportunity(o:OpportunityCandidateV2,cutoff:string){if(o.authority!=='NONE')throw new Error('MONEY_040_OPPORTUNITY_AUTHORITY_FORBIDDEN');if(o.informationCutoff>cutoff)throw new Error('MONEY_040_FUTURE_OPPORTUNITY');if(o.expiresAt<=cutoff)throw new Error('MONEY_040_STALE_OPPORTUNITY');if(o.riskStatus!=='ASSESSED'||o.liquidityStatus!=='ASSESSED')throw new Error('MONEY_040_OPPORTUNITY_NOT_GOVERNED')}
