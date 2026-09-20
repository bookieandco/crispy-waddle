import type { CommercialDealGate } from './commercial-deal-gate.js'
import type { CommercialReconciliation } from './commercial-reconciliation.js'
import type { ContractDraftPacket } from './contract-draft.js'
import type { ContractReadinessPacket } from './contract-readiness.js'
import type { EngagementLedger } from './engagement-ledger.js'
import type { EngagementReadinessGate } from './engagement-readiness.js'
import type { FulfillmentPlan } from './fulfillment-plan.js'
import type { OpportunityRequirementSet } from './opportunity-requirement.js'
import type { ProviderFreshnessResult } from './provider-freshness.js'
import type { ProviderNegotiationState } from './provider-negotiation.js'
import type { SamGovernedPursuitPlan } from './sam-pursuit-plan.js'

export const SAM_PURSUIT_SNAPSHOT_SCHEMA_VERSION=1 as const

export type SamPursuitSnapshot = {
  schemaVersion: typeof SAM_PURSUIT_SNAPSHOT_SCHEMA_VERSION
  opportunityId:string
  revision:number
  savedAt:string
  requirements:OpportunityRequirementSet
  fulfillment?:FulfillmentPlan
  commercial?:CommercialDealGate
  reconciliation?:CommercialReconciliation
  freshness:ProviderFreshnessResult[]
  engagement?:EngagementReadinessGate
  ledgers:EngagementLedger[]
  negotiations:ProviderNegotiationState[]
  contractReadiness:ContractReadinessPacket[]
  contractDrafts:ContractDraftPacket[]
  pursuit:SamGovernedPursuitPlan
}

export type SamPursuitSnapshotEnvelope={
  snapshot:SamPursuitSnapshot
  checksum:string
}

export interface SamPursuitSnapshotRepository{
  load(opportunityId:string):Promise<SamPursuitSnapshotEnvelope|null>
  save(envelope:SamPursuitSnapshotEnvelope,expectedRevision:number|null):Promise<void>
}

function stable(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value)
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']'
  const obj=value as Record<string,unknown>
  return '{'+Object.keys(obj).sort().map(k=>JSON.stringify(k)+':'+stable(obj[k])).join(',')+'}'
}
function checksum(value:unknown):string{
  const s=stable(value);let h=2166136261
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return 'fnv1a32:'+((h>>>0).toString(16).padStart(8,'0'))
}
function assertOpportunity(id:string, value:{opportunityId:string}|undefined, label:string){
  if(value&&value.opportunityId!==id)throw new Error(`${label} opportunity mismatch`)
}

export function createSamPursuitSnapshot(
  input:Omit<SamPursuitSnapshot,'schemaVersion'|'revision'|'savedAt'>,
  previousRevision=0,
  now=new Date().toISOString(),
):SamPursuitSnapshotEnvelope{
  const snapshot:SamPursuitSnapshot={...input,schemaVersion:SAM_PURSUIT_SNAPSHOT_SCHEMA_VERSION,revision:previousRevision+1,savedAt:now}
  assertSamPursuitSnapshotIntegrity(snapshot)
  return {snapshot,checksum:checksum(snapshot)}
}

export function assertSamPursuitSnapshotIntegrity(snapshot:SamPursuitSnapshot):void{
  if(snapshot.schemaVersion!==SAM_PURSUIT_SNAPSHOT_SCHEMA_VERSION)throw new Error('Unsupported SAM pursuit snapshot schema')
  if(snapshot.revision<1||!Number.isInteger(snapshot.revision))throw new Error('Snapshot revision must be a positive integer')
  const id=snapshot.opportunityId
  assertOpportunity(id,snapshot.requirements,'requirements');assertOpportunity(id,snapshot.fulfillment,'fulfillment')
  assertOpportunity(id,snapshot.commercial,'commercial');assertOpportunity(id,snapshot.reconciliation,'reconciliation')
  assertOpportunity(id,snapshot.engagement,'engagement');assertOpportunity(id,snapshot.pursuit,'pursuit')
  snapshot.freshness.forEach(x=>{if(!x.providerId.trim())throw new Error('Freshness provider id is required')})
  snapshot.ledgers.forEach(x=>{if(x.opportunityId!==id)throw new Error('ledger opportunity mismatch')})
  snapshot.negotiations.forEach(x=>assertOpportunity(id,x,'negotiation'))
  snapshot.contractReadiness.forEach(x=>assertOpportunity(id,x,'contract readiness'))
  snapshot.contractDrafts.forEach(x=>assertOpportunity(id,x,'contract draft'))
  if(snapshot.pursuit.executionAuthorized!==false)throw new Error('Persisted pursuit must not imply execution authorization')
}

export function recoverSamPursuitSnapshot(envelope:SamPursuitSnapshotEnvelope):SamPursuitSnapshot{
  if(checksum(envelope.snapshot)!==envelope.checksum)throw new Error('SAM pursuit snapshot checksum mismatch')
  assertSamPursuitSnapshotIntegrity(envelope.snapshot)
  return envelope.snapshot
}

export async function saveSamPursuitSnapshot(
  repository:SamPursuitSnapshotRepository,
  envelope:SamPursuitSnapshotEnvelope,
  expectedRevision:number|null,
):Promise<void>{
  recoverSamPursuitSnapshot(envelope)
  await repository.save(envelope,expectedRevision)
}
