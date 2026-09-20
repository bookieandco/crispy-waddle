import { createHash } from 'node:crypto'
import type { ExactAmount, RebalanceIntent } from './portfolio-construction-contracts.js'

export type ExecutionUrgency='LOW'|'NORMAL'|'HIGH'
export type OrderInstruction='MARKETABLE_LIMIT'|'PASSIVE_LIMIT'
export type ExecutionRouteSnapshot=Readonly<{routeId:string;provider:string;venue:string;instrumentId:string;status:'ACCEPTING'|'DEGRADED'|'REJECTING'|'UNKNOWN';observedAt:string;availableAt:string;evidenceIds:readonly string[];provenanceHash:string}>
export type ExecutionMarketSnapshot=Readonly<{snapshotId:string;instrumentId:string;currency:string;bidMinor:bigint;askMinor:bigint;bidSize:string;askSize:string;visibleDepthNotionalMinor:bigint;observedAt:string;availableAt:string;expiresAt:string;evidenceIds:readonly string[];provenanceHash:string}>
export type ExecutionSlice=Readonly<{sliceId:string;sequence:number;notional:ExactAmount;instruction:OrderInstruction;limitPriceMinor:bigint;earliestAt:string;expiresAt:string;idempotencyKey:string;authority:'NONE'}>
export type ExecutionPlan=Readonly<{executionPlanId:string;rebalanceIntentId:string;portfolioPlanId:string;instrumentId:string;side:'BUY'|'SELL';notional:ExactAmount;urgency:ExecutionUrgency;routeId:string;marketSnapshotId:string;slices:readonly ExecutionSlice[];maxSpreadBps:number;maxParticipationBps:number;informationCutoff:string;expiresAt:string;inputHash:string;provenanceHash:string;authority:'ANALYSIS_ONLY';requiresHumanApproval:true}>
export type ExecutionPreflight=Readonly<{preflightId:string;executionPlanId:string;status:'PASS'|'BLOCK';reasonCodes:readonly string[];checkedAt:string;routeSnapshotId:string;marketSnapshotId:string;authority:'NONE'}>
export type ApprovedExecutionBinding=Readonly<{bindingId:string;executionPlanId:string;actionRequestId:string;approvalId:string;authorityId:string;policyVersion:string;policyHash:string;actionRequestFingerprint:string;expiresAt:string;authority:'APPROVAL_REFERENCE_ONLY'}>
export type ExecutionOutcomeObservation=Readonly<{observationId:string;executionPlanId:string;sliceId:string;state:'FILLED'|'PARTIAL'|'REJECTED'|'CANCELLED'|'UNKNOWN';requestedNotional:ExactAmount;filledNotional:ExactAmount;referencePriceMinor:bigint;averageFillPriceMinor?:bigint;observedAt:string;evidenceIds:readonly string[];providerReference?:string;authority:'EVIDENCE_ONLY'}>
export type ExecutionLearningRecord=Readonly<{learningId:string;executionPlanId:string;fillRateBps:number;slippageBps?:number;unknownOutcome:boolean;createdAt:string;evidenceIds:readonly string[];authority:'LEARNING_ONLY'}>
export type ExecutionReplayManifest=Readonly<{replayId:string;executionPlanId:string;informationCutoff:string;routeSnapshotId:string;marketSnapshotId:string;excludedFutureEvidenceIds:readonly string[];inputHash:string;provenanceHash:string;authority:'RESEARCH_ONLY'}>

export function hash041(v:unknown){return createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')}
export function assertBps041(x:number,label:string){if(!Number.isInteger(x)||x<0||x>10000)throw new Error(`MONEY_041_${label}_BPS_INVALID`)}
export function assertRebalanceIntentExecutable(i:RebalanceIntent): asserts i is RebalanceIntent & {side:'BUY'|'SELL'}{if(i.authority!=='NONE')throw new Error('MONEY_041_REBALANCE_AUTHORITY_FORBIDDEN');if(i.side==='HOLD'||i.notional.minor<=0n)throw new Error('MONEY_041_REBALANCE_NOT_EXECUTABLE')}
