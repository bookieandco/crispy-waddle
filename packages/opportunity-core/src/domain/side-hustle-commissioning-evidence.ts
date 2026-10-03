import {
  buildSideHustleCommissioningItem,
  type SideHustleCommissioningGateType,
} from './side-hustle-commissioning.js'
import {
  getSideHustleProductionStatus,
  type SideHustleProductionReadiness,
} from './side-hustle-production-status.js'
import type {SideHustleFamily} from './side-hustles.js'

export type SideHustleCommissioningEvidenceStatus=
  |'pending'
  |'passed'
  |'blocked'
  |'not_applicable'

export type SideHustleCommissioningEvidence={
  id:string
  family:SideHustleFamily
  gateType:SideHustleCommissioningGateType
  status:Exclude<SideHustleCommissioningEvidenceStatus,'pending'>
  providerRef?:string
  note?:string
  evidenceRefs:string[]
  observedAt:string
  expiresAt?:string
  authority:'COMMISSIONING_EVIDENCE_ONLY'
  externalActionAuthorized:false
  moneyMovementAuthorized:false
}

export type SideHustleCommissioningGateState={
  gateType:SideHustleCommissioningGateType
  status:SideHustleCommissioningEvidenceStatus
  evidenceId?:string
  providerRef?:string
  observedAt?:string
  expiresAt?:string
  note?:string
}

export type SideHustleLiveCommissioningStatus=
  |'commissioning'
  |'blocked'
  |'certified'
  |'not_applicable'

export type SideHustleLiveCommissioningState={
  family:SideHustleFamily
  readiness:SideHustleProductionReadiness
  status:SideHustleLiveCommissioningStatus
  softwareReady:boolean
  gates:SideHustleCommissioningGateState[]
  blockers:string[]
  nextMilestones:string[]
  certifiedAt?:string
  authority:'COMMISSIONING_STATE_ONLY'
  externalActionAuthorized:false
  moneyMovementAuthorized:false
}

export function createSideHustleCommissioningEvidence(input:{
  id:string
  family:SideHustleFamily
  gateType:SideHustleCommissioningGateType
  status:Exclude<SideHustleCommissioningEvidenceStatus,'pending'>
  providerRef?:string
  note?:string
  evidenceRefs:string[]
  observedAt:string
  expiresAt?:string
}):SideHustleCommissioningEvidence{
  requireText(input.id,'commissioningEvidence.id')
  requireDate(input.observedAt,'commissioningEvidence.observedAt')
  const evidenceRefs=requireEvidence(input.evidenceRefs)
  if(input.expiresAt){
    requireDate(input.expiresAt,'commissioningEvidence.expiresAt')
    if(Date.parse(input.expiresAt)<=Date.parse(input.observedAt)){
      throw new Error('commissioningEvidence.expiresAt must follow observedAt')
    }
  }
  const status=getSideHustleProductionStatus(input.family)
  const plan=buildSideHustleCommissioningItem(status)
  if(!plan.gateTypes.includes(input.gateType)&&input.status!=='not_applicable'){
    throw new Error(`Commissioning gate ${input.gateType} is not required for ${input.family}`)
  }
  if(status.readiness==='capability_only'&&input.gateType!=='capability_boundary'){
    throw new Error('Capability-only Side Hustle accepts only capability-boundary evidence')
  }

  return{
    id:input.id.trim(),
    family:input.family,
    gateType:input.gateType,
    status:input.status,
    providerRef:input.providerRef?.trim()||undefined,
    note:input.note?.trim()||undefined,
    evidenceRefs,
    observedAt:input.observedAt,
    expiresAt:input.expiresAt,
    authority:'COMMISSIONING_EVIDENCE_ONLY',
    externalActionAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

export function evaluateSideHustleLiveCommissioning(input:{
  family:SideHustleFamily
  evidence:SideHustleCommissioningEvidence[]
  evaluatedAt:string
}):SideHustleLiveCommissioningState{
  requireDate(input.evaluatedAt,'commissioning.evaluatedAt')
  const production=getSideHustleProductionStatus(input.family)
  const plan=buildSideHustleCommissioningItem(production)

  if(production.readiness==='capability_only'){
    return{
      family:input.family,
      readiness:production.readiness,
      status:'not_applicable',
      softwareReady:false,
      gates:[{
        gateType:'capability_boundary',
        status:'not_applicable',
      }],
      blockers:[...production.blockers],
      nextMilestones:[...production.nextMilestones],
      authority:'COMMISSIONING_STATE_ONLY',
      externalActionAuthorized:false,
      moneyMovementAuthorized:false,
    }
  }

  const familyEvidence=input.evidence
    .filter(row=>row.family===input.family)
    .filter(row=>!row.expiresAt||Date.parse(row.expiresAt)>Date.parse(input.evaluatedAt))

  const gates=plan.gateTypes.map(gateType=>{
    const candidates=familyEvidence
      .filter(row=>row.gateType===gateType)
      .sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))
    const latest=candidates[0]
    if(!latest)return{gateType,status:'pending' as const}
    return{
      gateType,
      status:latest.status,
      evidenceId:latest.id,
      providerRef:latest.providerRef,
      observedAt:latest.observedAt,
      expiresAt:latest.expiresAt,
      note:latest.note,
    }
  })

  const hasBlocked=gates.some(gate=>gate.status==='blocked')
  const allPassed=gates.length>0&&gates.every(gate=>gate.status==='passed'||gate.status==='not_applicable')
  const status:SideHustleLiveCommissioningStatus=hasBlocked?'blocked':allPassed?'certified':'commissioning'
  const certifiedAt=status==='certified'
    ?gates.map(g=>g.observedAt).filter((v):v is string=>!!v).sort().at(-1)
    :undefined

  return{
    family:input.family,
    readiness:production.readiness,
    status,
    softwareReady:plan.softwareReady,
    gates,
    blockers:[...production.blockers],
    nextMilestones:[...production.nextMilestones],
    certifiedAt,
    authority:'COMMISSIONING_STATE_ONLY',
    externalActionAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

export function summarizeLiveCommissioning(states:SideHustleLiveCommissioningState[]){
  return{
    total:states.length,
    commercial:states.filter(s=>s.readiness!=='capability_only').length,
    certified:states.filter(s=>s.status==='certified').length,
    blocked:states.filter(s=>s.status==='blocked').length,
    commissioning:states.filter(s=>s.status==='commissioning').length,
    notApplicable:states.filter(s=>s.status==='not_applicable').length,
    externalActionAuthorized:false as const,
    moneyMovementAuthorized:false as const,
  }
}

function requireText(value:string,field:string){
  if(typeof value!=='string'||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}
function requireDate(value:string,field:string){
  if(!Number.isFinite(Date.parse(value)))throw new Error(`${field} must be a valid date`)
  return value
}
function requireEvidence(values:readonly string[]){
  const normalized=[...new Set(values.map(v=>v.trim()).filter(Boolean))]
  if(!normalized.length)throw new Error('commissioning evidenceRefs are required')
  return normalized
}
