import type {
  CanonicalIdentityCandidate,
  CanonicalRelationshipFact,
  RelationshipObservation,
} from '@jhadina/relationship-core'
import {normalizeRelationshipIdentity} from '@jhadina/relationship-core'
import {ProductionRelationshipRepository} from './production-repository'

const STRONG_DURABLE_SCHEMES=new Set<CanonicalIdentityCandidate['scheme']>(['uei','cage','sam_entity'])

function slug(value:string):string{
  return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'unknown'
}

export async function persistDurableIdentityEvidence(input:{
  repo:ProductionRelationshipRepository
  entityId:string
  identities:readonly CanonicalIdentityCandidate[]
  observedAt:string
  sourceKind:string
}):Promise<number>{
  let verified=0
  for(const identity of input.identities){
    if(!STRONG_DURABLE_SCHEMES.has(identity.scheme)||identity.evidenceRefs.length===0)continue
    const normalized=normalizeRelationshipIdentity(identity.scheme,identity.value)
    const observationId='observation:'+input.entityId+':'+identity.scheme+':'+slug(normalized)
    const observation:RelationshipObservation={
      id:observationId,
      entityId:input.entityId,
      sourceRef:identity.evidenceRefs[0]!,
      sourceKind:input.sourceKind,
      field:identity.scheme,
      observedValue:normalized,
      observedAt:input.observedAt,
      strength:'strong',
      payload:{
        identityScheme:identity.scheme,
        sourceEvidenceRefs:[...identity.evidenceRefs],
        inferred:false,
      },
    }
    await input.repo.appendObservation(observation)
    const fact:CanonicalRelationshipFact={
      id:'fact:'+input.entityId+':'+identity.scheme,
      entityId:input.entityId,
      field:identity.scheme,
      value:normalized,
      evidenceRefs:[observationId],
      status:'verified',
      verifiedAt:input.observedAt,
    }
    await input.repo.upsertFact(fact)
    verified+=1
  }
  return verified
}
