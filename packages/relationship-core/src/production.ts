import type {
  EntityContextLink,
  RelationshipActivity,
  RelationshipEntity,
  RelationshipFactSuggestion,
  RelationshipIdentity,
  RelationshipProjection,
  RelationshipRole,
  RelationshipWorkItem,
} from './index.js'

export type RelationshipEdge={
  readonly id:string
  readonly fromEntityId:string
  readonly toEntityId:string
  readonly relation:string
  readonly contextRef?:string
  readonly validFrom:string
  readonly validTo?:string
  readonly evidenceRefs:readonly string[]
}

export type RelationshipIntelligenceKind=
  |'freshness'
  |'last_interaction'
  |'unanswered_thread'
  |'quote_aging'
  |'continuity'
  |'decision_makers'
  |'opportunity_overlap'
  |'evidence_conflict'
  |'next_research'

export type RelationshipIntelligenceSignal={
  readonly id:string
  readonly entityId:string
  readonly kind:RelationshipIntelligenceKind
  readonly value:unknown
  readonly summary:string
  readonly observedAt:string
  readonly evidenceRefs:readonly string[]
  readonly authority:'ANALYSIS_ONLY'
}

export type CanonicalIdentityCandidate={
  readonly scheme:RelationshipIdentity['scheme']
  readonly value:string
  readonly evidenceRefs:readonly string[]
}

export function normalizeRelationshipIdentity(
  scheme:RelationshipIdentity['scheme'],
  value:string,
):string{
  const trimmed=value.trim()
  if(!trimmed)throw new Error('RELATIONSHIP_IDENTITY_VALUE_REQUIRED')
  if(scheme==='email'||scheme==='domain'||scheme==='linkedin'||scheme==='github'||scheme==='social_handle'){
    return trimmed.toLowerCase()
  }
  if(scheme==='phone')return trimmed.replace(/[^0-9+]/g,'')
  return trimmed.toUpperCase()
}

function slug(value:string):string{
  const out=value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
  return out||'unknown'
}

const GLOBAL_IDENTITY_PRIORITY:readonly RelationshipIdentity['scheme'][]=[
  'uei','cage','domain','sam_entity',
]

export function chooseCanonicalOrganizationId(input:{
  readonly sourceNamespace:string
  readonly sourceId:string
  readonly identities:readonly CanonicalIdentityCandidate[]
}):string{
  for(const scheme of GLOBAL_IDENTITY_PRIORITY){
    const found=input.identities.find(row=>row.scheme===scheme&&row.value.trim())
    if(found)return 'org:'+scheme+':'+slug(normalizeRelationshipIdentity(scheme,found.value))
  }
  return 'org:'+slug(input.sourceNamespace)+':'+slug(input.sourceId)
}

export function projectSamPrimeEvent(input:{
  readonly ownerUserId:string
  readonly organizationId:string
  readonly displayName:string
  readonly event:{
    readonly primeId:string
    readonly opportunityId?:string
    readonly kind:string
    readonly occurredAt:string
    readonly evidenceRefs:readonly string[]
    readonly amount?:number
    readonly currency?:string
  }
}):RelationshipProjection{
  if(input.event.primeId!==input.organizationId)throw new Error('RELATIONSHIP_SAM_PRIME_ID_MISMATCH')
  if(input.event.evidenceRefs.length===0)throw new Error('RELATIONSHIP_PROJECTION_EVIDENCE_REQUIRED')
  const contextRef=input.event.opportunityId??'prime-account:'+input.organizationId
  const entity:RelationshipEntity=Object.freeze({
    id:input.organizationId,
    ownerUserId:input.ownerUserId,
    kind:'organization',
    displayName:input.displayName,
    aliases:Object.freeze([]),
    status:'active',
    evidenceRefs:Object.freeze([...input.event.evidenceRefs]),
    createdAt:input.event.occurredAt,
    updatedAt:input.event.occurredAt,
    authority:'RELATIONSHIP_INTELLIGENCE_ONLY',
  })
  const role:RelationshipRole=Object.freeze({
    id:'role:'+input.organizationId+':sam:prime:'+contextRef,
    entityId:input.organizationId,
    role:'prime',
    domain:'sam',
    contextRef,
    validFrom:input.event.occurredAt,
    evidenceRefs:Object.freeze([...input.event.evidenceRefs]),
  })
  const activity:RelationshipActivity=Object.freeze({
    id:'activity:sam:prime:'+input.event.kind+':'+input.event.primeId+':'+input.event.occurredAt,
    entityId:input.organizationId,
    type:'sam.prime.'+input.event.kind,
    occurredAt:input.event.occurredAt,
    contextRef,
    summary:'SAM prime relationship event: '+input.event.kind,
    evidenceRefs:Object.freeze([...input.event.evidenceRefs]),
    metadata:Object.freeze({amount:input.event.amount,currency:input.event.currency}),
  })
  const contextLink:EntityContextLink=Object.freeze({
    id:'link:sam:prime:'+input.organizationId+':'+contextRef,
    entityId:input.organizationId,
    contextKind:'opportunity',
    contextRef,
    relation:'sam:prime',
    occurredAt:input.event.occurredAt,
    evidenceRefs:Object.freeze([...input.event.evidenceRefs]),
  })
  return Object.freeze({entity,role,activity,contextLink})
}

export type RelationshipPipelineTemplate={
  readonly objectDefinition:{
    readonly id:string
    readonly labelSingular:string
    readonly labelPlural:string
    readonly fields:readonly {
      readonly key:string
      readonly label:string
      readonly type:'text'|'number'|'currency'|'boolean'|'date'|'enum'|'entity_ref'
      readonly required?:boolean
      readonly options?:readonly string[]
    }[]
  }
  readonly pipeline:{
    readonly id:string
    readonly label:string
    readonly objectDefinitionId:string
    readonly stages:readonly {readonly id:string;readonly label:string;readonly order:number;readonly terminal?:boolean}[]
  }
}

const commonFields=Object.freeze([
  Object.freeze({key:'source',label:'Source',type:'text' as const}),
  Object.freeze({key:'opportunityRef',label:'Opportunity',type:'text' as const}),
  Object.freeze({key:'estimatedValue',label:'Estimated Value',type:'currency' as const}),
])

export const DEFAULT_RELATIONSHIP_PIPELINES:readonly RelationshipPipelineTemplate[]=Object.freeze([
  Object.freeze({
    objectDefinition:Object.freeze({id:'sam_teaming_account',labelSingular:'SAM Teaming Account',labelPlural:'SAM Teaming Accounts',fields:commonFields}),
    pipeline:Object.freeze({id:'sam_teaming',label:'SAM Teaming',objectDefinitionId:'sam_teaming_account',stages:Object.freeze([
      {id:'discovered',label:'Discovered',order:1},{id:'qualified',label:'Qualified',order:2},
      {id:'registered',label:'Vendor Registered',order:3},{id:'capability_sent',label:'Capability Sent',order:4},
      {id:'rfq',label:'RFQ',order:5},{id:'quote',label:'Quote Submitted',order:6},
      {id:'subcontract',label:'Subcontract',order:7},{id:'active',label:'Active Work',order:8},
      {id:'closed',label:'Closed',order:9,terminal:true},
    ])}),
  }),
  Object.freeze({
    objectDefinition:Object.freeze({id:'public_buyer_account',labelSingular:'Public Buyer',labelPlural:'Public Buyers',fields:commonFields}),
    pipeline:Object.freeze({id:'public_buyer',label:'Public Buyer Relationship',objectDefinitionId:'public_buyer_account',stages:Object.freeze([
      {id:'discovered',label:'Discovered',order:1},{id:'contact_identified',label:'Contact Identified',order:2},
      {id:'opportunity_linked',label:'Opportunity Linked',order:3},{id:'engaged',label:'Engaged',order:4},
      {id:'active',label:'Active',order:5},{id:'dormant',label:'Dormant',order:6,terminal:true},
    ])}),
  }),
  Object.freeze({
    objectDefinition:Object.freeze({id:'subcontractor_account',labelSingular:'Subcontractor',labelPlural:'Subcontractors',fields:commonFields}),
    pipeline:Object.freeze({id:'subcontractor_acquisition',label:'Subcontractor Acquisition',objectDefinitionId:'subcontractor_account',stages:Object.freeze([
      {id:'discovered',label:'Discovered',order:1},{id:'researched',label:'Researched',order:2},
      {id:'qualified',label:'Qualified',order:3},{id:'quote_requested',label:'Quote Requested',order:4},
      {id:'quote_received',label:'Quote Received',order:5},{id:'contracted',label:'Contracted',order:6},
      {id:'active',label:'Active',order:7},
    ])}),
  }),
  Object.freeze({
    objectDefinition:Object.freeze({id:'commercial_prospect_account',labelSingular:'Commercial Prospect',labelPlural:'Commercial Prospects',fields:commonFields}),
    pipeline:Object.freeze({id:'commercial_prospecting',label:'Commercial Prospecting',objectDefinitionId:'commercial_prospect_account',stages:Object.freeze([
      {id:'discovered',label:'Discovered',order:1},{id:'researched',label:'Researched',order:2},
      {id:'draft_ready',label:'Draft Ready',order:3},{id:'approval_required',label:'Approval Required',order:4},
      {id:'contacted',label:'Contacted',order:5},{id:'responded',label:'Responded',order:6},
      {id:'won',label:'Won',order:7,terminal:true},{id:'lost',label:'Lost',order:8,terminal:true},
    ])}),
  }),
  Object.freeze({
    objectDefinition:Object.freeze({id:'affiliate_vendor_account',labelSingular:'Affiliate / Vendor',labelPlural:'Affiliates / Vendors',fields:commonFields}),
    pipeline:Object.freeze({id:'affiliate_vendor',label:'Affiliate / Vendor Management',objectDefinitionId:'affiliate_vendor_account',stages:Object.freeze([
      {id:'discovered',label:'Discovered',order:1},{id:'validated',label:'Validated',order:2},
      {id:'approved',label:'Approved',order:3},{id:'active',label:'Active',order:4},
      {id:'paused',label:'Paused',order:5},{id:'ended',label:'Ended',order:6,terminal:true},
    ])}),
  }),
  Object.freeze({
    objectDefinition:Object.freeze({id:'customer_account',labelSingular:'Customer',labelPlural:'Customers',fields:commonFields}),
    pipeline:Object.freeze({id:'customer_lifecycle',label:'Customer Lifecycle',objectDefinitionId:'customer_account',stages:Object.freeze([
      {id:'lead',label:'Lead',order:1},{id:'prospect',label:'Prospect',order:2},
      {id:'customer',label:'Customer',order:3},{id:'repeat',label:'Repeat Customer',order:4},
      {id:'loyal',label:'Loyal',order:5},{id:'inactive',label:'Inactive',order:6,terminal:true},
    ])}),
  }),
])

const ACTIVITY_STAGE_MAP:Readonly<Record<string,Readonly<Record<string,string>>>>=Object.freeze({
  sam_teaming:Object.freeze({
    'sam.prime.introduced':'discovered',
    'sam.prime.vendor_registration_complete':'registered',
    'sam.prime.capability_statement_sent':'capability_sent',
    'sam.prime.rfq_received':'rfq',
    'sam.prime.quote_submitted':'quote',
    'sam.prime.subcontract_signed':'subcontract',
    'sam.prime.work_started':'active',
  }),
  subcontractor_acquisition:Object.freeze({
    'sam.provider.discovered':'discovered',
    'sam.provider.quote_received':'quote_received',
    'sam.provider.contracted':'contracted',
    'sam.provider.performance':'active',
  }),
  commercial_prospecting:Object.freeze({
    'commercial.prospect.discovered':'discovered',
    'commercial.prospect.researched':'researched',
    'commercial.outreach_prepared':'draft_ready',
    'commercial.outreach_approval_required':'approval_required',
    'commercial.outreach_sent':'contacted',
    'commercial.response_received':'responded',
  }),
  customer_lifecycle:Object.freeze({
    'growth.customer.lead':'lead',
    'growth.customer.prospect':'prospect',
    'growth.customer.converted':'customer',
    'growth.customer.repeat_purchase':'repeat',
    'growth.customer.loyal':'loyal',
    'growth.customer.inactive':'inactive',
  }),
})

export function recommendedPipelineStage(pipelineId:string,activityType:string):string|undefined{
  return ACTIVITY_STAGE_MAP[pipelineId]?.[activityType]
}

export function buildSafeRelationshipWork(input:{
  readonly id:string
  readonly ownerUserId:string
  readonly entityId:string
  readonly capability:string
  readonly reason:string
  readonly dueAt:string
  readonly priority?:number
  readonly correlationId:string
  readonly evidenceRefs:readonly string[]
  readonly budget?:number
}):RelationshipWorkItem{
  return Object.freeze({
    id:input.id,
    ownerUserId:input.ownerUserId,
    capability:input.capability,
    entityRef:input.entityId,
    reason:input.reason,
    dueAt:input.dueAt,
    priority:input.priority??0,
    status:'pending',
    attemptCount:0,
    budget:input.budget,
    correlationId:input.correlationId,
    evidenceRefs:Object.freeze([...input.evidenceRefs]),
    executionAuthorized:false,
  })
}

function ageDays(now:string,then:string|undefined):number|undefined{
  if(!then)return undefined
  const n=Date.parse(now),t=Date.parse(then)
  if(!Number.isFinite(n)||!Number.isFinite(t))return undefined
  return Math.max(0,(n-t)/86_400_000)
}

function latest<T extends {readonly occurredAt:string}>(rows:readonly T[]):T|undefined{
  return [...rows].sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt))[0]
}

export function deriveRelationshipIntelligence(input:{
  readonly entityId:string
  readonly now:string
  readonly activities:readonly RelationshipActivity[]
  readonly links:readonly EntityContextLink[]
  readonly suggestions:readonly RelationshipFactSuggestion[]
  readonly identities:readonly RelationshipIdentity[]
  readonly roles:readonly RelationshipRole[]
  readonly decisionMakerCount?:number
}):readonly RelationshipIntelligenceSignal[]{
  const signals:RelationshipIntelligenceSignal[]=[]
  const last=latest(input.activities)
  const freshness=ageDays(input.now,last?.occurredAt)
  const evidence=[...new Set(input.activities.flatMap(row=>row.evidenceRefs))]
  const push=(kind:RelationshipIntelligenceKind,value:unknown,summary:string,refs:readonly string[]=evidence)=>{
    signals.push(Object.freeze({
      id:'intel:'+input.entityId+':'+kind,
      entityId:input.entityId,
      kind,
      value,
      summary,
      observedAt:input.now,
      evidenceRefs:Object.freeze([...refs]),
      authority:'ANALYSIS_ONLY',
    }))
  }

  push('freshness',freshness??null,freshness===undefined?'No interaction history is available.':freshness<=7?'Relationship is fresh.':freshness<=30?'Relationship needs routine follow-up research.':'Relationship context is stale.')
  if(last)push('last_interaction',{type:last.type,occurredAt:last.occurredAt},'Most recent recorded interaction: '+last.type,last.evidenceRefs)

  const quotes=input.activities.filter(row=>row.type.includes('quote_received')||row.type.includes('quote_refreshed'))
  const quote=latest(quotes)
  const quoteAge=ageDays(input.now,quote?.occurredAt)
  if(quote)push('quote_aging',quoteAge??null,(quoteAge??0)>14?'Quote evidence is aging and should be revalidated.':'Quote evidence is currently recent.',quote.evidenceRefs)

  const outbound=input.activities.filter(row=>/sent|submitted|outreach/i.test(row.type))
  const inbound=input.activities.filter(row=>/response_received|reply|received/i.test(row.type))
  const lastOutbound=latest(outbound),lastInbound=latest(inbound)
  const unanswered=Boolean(lastOutbound&&(!lastInbound||lastInbound.occurredAt<lastOutbound.occurredAt))
  push('unanswered_thread',unanswered,unanswered?'An outbound interaction has no later recorded response.':'No unanswered outbound thread is evident.')

  const opportunityCount=new Set(input.links.filter(row=>row.contextKind==='opportunity').map(row=>row.contextRef)).size
  push('opportunity_overlap',opportunityCount,opportunityCount===0?'No linked opportunities.':String(opportunityCount)+' linked opportunity context(s).')

  const conflictCount=input.suggestions.filter(row=>row.status==='pending'&&/conflict/i.test(row.reason)).length
  push('evidence_conflict',conflictCount,conflictCount?'Evidence conflicts require review.':'No pending evidence conflict is recorded.')

  const decisionMakerCount=input.decisionMakerCount??0
  push('decision_makers',decisionMakerCount,decisionMakerCount?'Known decision-maker relationship(s) are linked.':'No verified decision maker is linked yet.')

  const providerOrPrime=input.roles.some(row=>row.role==='provider'||row.role==='prime')
  const continuityRecent=input.activities.some(row=>/provider_reconfirmed|meeting_held|payment_received|work_started/.test(row.type)&&(ageDays(input.now,row.occurredAt)??999)<=30)
  push('continuity',{providerOrPrime,continuityRecent},providerOrPrime?(continuityRecent?'Provider/prime continuity has recent evidence.':'Provider/prime continuity needs refreshed evidence.'):'Continuity signal is not applicable.')

  let next='Review current context and schedule the next evidence-backed research check.'
  if(input.identities.length===0)next='Verify at least one durable organization identity (UEI, CAGE, domain, or source entity ID).'
  else if(decisionMakerCount===0)next='Identify and verify the current decision maker or operational contact.'
  else if(unanswered)next='Check approved communication channels for a response before preparing any new outreach.'
  else if((quoteAge??0)>14)next='Revalidate quote validity and provider capacity.'
  else if((freshness??0)>30)next='Refresh public/company evidence and relationship continuity.'
  push('next_research',next,next)

  return Object.freeze(signals)
}

export function fuseRelationshipContext(input:{
  readonly entityId:string
  readonly kind:EntityContextLink['contextKind']
  readonly contextRef:string
  readonly relation:string
  readonly activityType:string
  readonly summary:string
  readonly occurredAt:string
  readonly evidenceRefs:readonly string[]
  readonly metadata?:Readonly<Record<string,unknown>>
}):{activity:RelationshipActivity;link:EntityContextLink}{
  if(input.evidenceRefs.length===0)throw new Error('RELATIONSHIP_CONTEXT_EVIDENCE_REQUIRED')
  return Object.freeze({
    activity:Object.freeze({
      id:'activity:fusion:'+input.entityId+':'+input.kind+':'+input.contextRef+':'+input.occurredAt,
      entityId:input.entityId,
      type:input.activityType,
      occurredAt:input.occurredAt,
      contextRef:input.contextRef,
      summary:input.summary,
      evidenceRefs:Object.freeze([...input.evidenceRefs]),
      metadata:Object.freeze({...input.metadata,authority:'CONTEXT_ONLY'}),
    }),
    link:Object.freeze({
      id:'link:fusion:'+input.entityId+':'+input.kind+':'+input.contextRef+':'+input.relation,
      entityId:input.entityId,
      contextKind:input.kind,
      contextRef:input.contextRef,
      relation:input.relation,
      occurredAt:input.occurredAt,
      evidenceRefs:Object.freeze([...input.evidenceRefs]),
    }),
  })
}
