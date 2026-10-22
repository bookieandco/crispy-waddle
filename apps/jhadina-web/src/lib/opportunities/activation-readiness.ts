import type { StoredCanonicalOpportunity } from './canonical'

export type OpportunityActivationReadiness={
  authenticated:true
  storedOpportunityCount:number
  potentiallyResearchableCount:number
  publicJobCount:number
  sourceHostsConfigured:number
  agentPersistenceConfigured:boolean
  privateIphoneCertified:false
  automatedDiscoveryAuthorized:false
  ownerApplicationAuthority:false
  status:'blocked'|'ready_for_owner_private_canary'
  blockers:string[]
}

/** Account-scoped facts only, not a deployment or Face ID certification. */
export function calculateOpportunityActivationReadiness(input:{
  ownerId:string
  stored:StoredCanonicalOpportunity[]
  allowedSourceHosts:string[]
  agentPersistenceConfigured:boolean
}):OpportunityActivationReadiness{
  if(!input.ownerId.trim())throw Error('Owner required')
  const owned=input.stored.filter(s=>s.userId===input.ownerId)
  const potentiallyResearchable=owned.filter(s=>{
    const hosts=new Set(s.opportunity.evidence.filter(e=>
      /^https:\/\//.test(e.sourceUrl)&&typeof e.excerpt==='string'&&e.excerpt.trim().length>=10
    ).map(e=>{try{return new URL(e.sourceUrl).hostname}catch{return ''}}))
    return hosts.size>=2
  })
  const hostCount=new Set(input.allowedSourceHosts.map(s=>s.trim().toLowerCase()).filter(Boolean)).size
  const blockers:string[]=[]
  if(!input.agentPersistenceConfigured)blockers.push('Agent Runtime server persistence is not configured')
  if(owned.length===0)blockers.push('No persisted owner opportunities')
  if(potentiallyResearchable.length===0)blockers.push('No opportunity with two attributable source hosts')
  if(hostCount<2)blockers.push('Two approved public research hosts are not configured')
  return {
    authenticated:true,storedOpportunityCount:owned.length,
    potentiallyResearchableCount:potentiallyResearchable.length,
    publicJobCount:owned.filter(s=>s.opportunity.family==='employment'&&s.opportunity.type==='job').length,
    sourceHostsConfigured:hostCount,
    agentPersistenceConfigured:input.agentPersistenceConfigured,
    privateIphoneCertified:false,automatedDiscoveryAuthorized:false,ownerApplicationAuthority:false,
    status:blockers.length===0?'ready_for_owner_private_canary':'blocked',blockers,
  }
}
