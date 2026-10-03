import {
  SIDE_HUSTLE_DEFINITIONS,
  createSideHustleCommissioningEvidence,
  evaluateSideHustleLiveCommissioning,
  summarizeLiveCommissioning,
  type SideHustleCommissioningEvidence,
  type SideHustleCommissioningEvidenceStatus,
  type SideHustleCommissioningGateType,
  type SideHustleFamily,
} from '@jhadina/opportunity-core'
import type {SideHustleCommissioningEvidenceRepository} from './side-hustle-commissioning-repository'

export async function recordSideHustleCommissioningEvidenceRuntime(input:{
  id:string
  family:SideHustleFamily
  gateType:SideHustleCommissioningGateType
  status:Exclude<SideHustleCommissioningEvidenceStatus,'pending'>
  providerRef?:string
  note?:string
  evidenceRefs:string[]
  observedAt?:string
  expiresAt?:string
},repository:SideHustleCommissioningEvidenceRepository):Promise<SideHustleCommissioningEvidence>{
  const evidence=createSideHustleCommissioningEvidence({
    ...input,
    observedAt:input.observedAt??new Date().toISOString(),
  })
  return repository.record(evidence)
}

export async function listSideHustleLiveCommissioningRuntime(input:{
  family?:SideHustleFamily
  evaluatedAt?:string
},repository:SideHustleCommissioningEvidenceRepository){
  const evaluatedAt=input.evaluatedAt??new Date().toISOString()
  const evidence=await repository.list(input.family?{family:input.family}:{})
  const families=input.family
    ?[input.family]
    :SIDE_HUSTLE_DEFINITIONS.map(definition=>definition.family)
  const states=families.map(family=>evaluateSideHustleLiveCommissioning({
    family,
    evidence,
    evaluatedAt,
  }))
  return{
    evaluatedAt,
    states,
    summary:summarizeLiveCommissioning(states),
    externalActionAuthorized:false as const,
    moneyMovementAuthorized:false as const,
  }
}
