import {
  listSideHustleProductionStatus,
  type SideHustleProductionReadiness,
  type SideHustleProductionStatus,
} from './side-hustle-production-status.js'
import type {SideHustleFamily} from './side-hustles.js'

export type SideHustleCommissioningGateType=
  |'provider'
  |'credential'
  |'live_customer'
  |'payment_billing'
  |'deployment'
  |'outreach_authority'
  |'data_analytics'
  |'physical_evidence'
  |'compliance'
  |'human_operator'
  |'capability_boundary'
  |'software'

export const SIDE_HUSTLE_COMMISSIONING_GATE_TYPES = [
  'provider','credential','live_customer','payment_billing','deployment',
  'outreach_authority','data_analytics','physical_evidence','compliance',
  'human_operator','capability_boundary','software',
] as const satisfies readonly SideHustleCommissioningGateType[]

export type SideHustleCommissioningItem={
  family:SideHustleFamily
  readiness:SideHustleProductionReadiness
  softwareReady:boolean
  gateTypes:SideHustleCommissioningGateType[]
  blockers:string[]
  nextMilestones:string[]
  liveCommercialEvidenceRequired:boolean
  priority:number
  authority:'COMMISSIONING_PLAN_ONLY'
  externalActionAuthorized:false
  moneyMovementAuthorized:false
}

export type SideHustleCommissioningSummary={
  totalFamilies:number
  commercialFamilies:number
  softwareReadyCommercialFamilies:number
  validationOnlyFamilies:number
  liveCandidates:number
  capabilityOnlyFamilies:number
  byGate:Record<SideHustleCommissioningGateType,number>
  externalActionAuthorized:false
  moneyMovementAuthorized:false
}

export function buildSideHustleCommissioningItem(
  status:SideHustleProductionStatus,
):SideHustleCommissioningItem{
  const softwareReady=status.readiness!=='validation_ready'&&status.readiness!=='capability_only'
  const gateTypes=status.readiness==='capability_only'
    ?['capability_boundary' as const]
    :uniqueGates([
      ...status.blockers.flatMap(classifyCommissioningText),
      ...status.nextMilestones.flatMap(classifyCommissioningText),
      ...(softwareReady?[]:['software' as const]),
      ...(status.liveCommercialEvidenceRequired?['live_customer' as const]:[]),
    ])
  return{
    family:status.family,
    readiness:status.readiness,
    softwareReady,
    gateTypes,
    blockers:[...status.blockers],
    nextMilestones:[...status.nextMilestones],
    liveCommercialEvidenceRequired:status.liveCommercialEvidenceRequired,
    priority:priorityFor(status.readiness),
    authority:'COMMISSIONING_PLAN_ONLY',
    externalActionAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

export function listSideHustleCommissioningQueue():SideHustleCommissioningItem[]{
  return listSideHustleProductionStatus()
    .map(buildSideHustleCommissioningItem)
    .sort((a,b)=>a.priority-b.priority||a.family.localeCompare(b.family))
}

export function summarizeSideHustleCommissioning(
  queue:SideHustleCommissioningItem[]=listSideHustleCommissioningQueue(),
):SideHustleCommissioningSummary{
  const commercial=queue.filter(item=>item.readiness!=='capability_only')
  const gates=[...SIDE_HUSTLE_COMMISSIONING_GATE_TYPES]
  const byGate=Object.fromEntries(gates.map(gate=>[
    gate,queue.filter(item=>item.gateTypes.includes(gate)).length,
  ])) as Record<SideHustleCommissioningGateType,number>
  return{
    totalFamilies:queue.length,
    commercialFamilies:commercial.length,
    softwareReadyCommercialFamilies:commercial.filter(item=>item.softwareReady).length,
    validationOnlyFamilies:queue.filter(item=>item.readiness==='validation_ready').length,
    liveCandidates:queue.filter(item=>item.readiness==='live_candidate').length,
    capabilityOnlyFamilies:queue.filter(item=>item.readiness==='capability_only').length,
    byGate,
    externalActionAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

function classifyCommissioningText(text:string):SideHustleCommissioningGateType[]{
  const value=text.toLowerCase()
  const gates:SideHustleCommissioningGateType[]=[]
  if(/provider|supplier|network|platform|printify|membership/.test(value))gates.push('provider')
  if(/credential|token|api key|access\b/.test(value))gates.push('credential')
  if(/paid|customer|client|commercial outcome|realized outcome|real job|real order|live order/.test(value))gates.push('live_customer')
  if(/payment|billing|checkout|transaction|payout|refund/.test(value))gates.push('payment_billing')
  if(/deploy|hosting|builder|site|rollback/.test(value))gates.push('deployment')
  if(/outreach|contact|bid|publish|assignment authority|authorized/.test(value))gates.push('outreach_authority')
  if(/analytics|traffic|conversion|citation|query|measurement|attribution/.test(value))gates.push('data_analytics')
  if(/physical sample|sample matrix|physical passing|physical evidence/.test(value))gates.push('physical_evidence')
  if(/insurance|compliance|license|terms-review|regulatory/.test(value))gates.push('compliance')
  if(/human operator|human delivery|operator\/scheduling|selected human/.test(value))gates.push('human_operator')
  return uniqueGates(gates)
}

function priorityFor(readiness:SideHustleProductionReadiness):number{
  if(readiness==='live_candidate')return 0
  if(readiness==='adapter_ready')return 10
  if(readiness==='execution_spine')return 20
  if(readiness==='validation_ready')return 30
  return 100
}

function uniqueGates(values:SideHustleCommissioningGateType[]):SideHustleCommissioningGateType[]{
  return [...new Set(values)]
}
