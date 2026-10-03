export type PumpMigrationStage =
  | 'DISCOVERED'
  | 'APPROACHING_GRADUATION'
  | 'CURVE_COMPLETE'
  | 'PUMPSWAP_MIGRATED'

export type PumpMigrationObservation = Readonly<{
  observationId:string
  mint:string
  observedAt:string
  availableAt:string
  initialRealTokenReserves?:bigint
  realTokenReserves?:bigint
  complete?:boolean
  pumpSwapPoolAddress?:string
  holderCount?:number
  uniqueBuyerCount?:number
  volumeAccelerationScore?:number
  buyPressureScore?:number
  holderGrowthScore?:number
  creatorRiskScore?:number
  clusterRiskScore?:number
  sniperInventoryRisk?:number
  rugBlocked?:boolean
  evidenceIds:readonly string[]
}>

export type PumpMigrationRadarCandidate = Readonly<{
  candidateId:string
  mint:string
  stage:PumpMigrationStage
  graduationProgress?:number
  discoveryScore:number
  disposition:'WATCH'|'REVIEW'|'BLOCK'
  blockers:readonly string[]
  missingChecks:readonly string[]
  observedAt:string
  availableAt:string
  pumpSwapPoolAddress?:string
  evidenceIds:readonly string[]
  authority:'RESEARCH_ONLY'
  canAuthorizeTrade:false
}>

const bounded=(value:number|undefined):number|undefined=>{
  if(value===undefined||!Number.isFinite(value))return undefined
  return Math.max(0,Math.min(1,value))
}
const assertIso=(value:string,code:string)=>{
  if(!value||Number.isNaN(Date.parse(value)))throw new Error(code)
}
const assertCount=(value:number|undefined,code:string)=>{
  if(value!==undefined&&(!Number.isFinite(value)||value<0))throw new Error(code)
}

export function pumpGraduationProgress(input:Pick<PumpMigrationObservation,'initialRealTokenReserves'|'realTokenReserves'|'complete'>):number|undefined{
  if(input.complete===true)return 1
  const initial=input.initialRealTokenReserves
  const current=input.realTokenReserves
  if(initial===undefined||current===undefined||initial<=0n||current<0n)return undefined
  if(current>=initial)return 0
  const scaled=(initial-current)*1_000_000n/initial
  return Number(scaled)/1_000_000
}

export function classifyPumpMigrationStage(input:PumpMigrationObservation,approachingThreshold=0.9):PumpMigrationStage{
  if(input.pumpSwapPoolAddress)return 'PUMPSWAP_MIGRATED'
  if(input.complete===true||input.realTokenReserves===0n)return 'CURVE_COMPLETE'
  const progress=pumpGraduationProgress(input)
  return progress!==undefined&&progress>=approachingThreshold?'APPROACHING_GRADUATION':'DISCOVERED'
}

/**
 * Discovery ranking only. This deliberately does not replace actor-aware assessment,
 * rug protection, Money risk, paper simulation, shadow execution, or capital authority.
 */
export function buildPumpMigrationRadarCandidate(
  input:PumpMigrationObservation,
  options:Readonly<{approachingThreshold?:number}>={},
):PumpMigrationRadarCandidate{
  if(!input.observationId.trim()||!input.mint.trim())throw new Error('pump_migration_identity_required')
  assertIso(input.observedAt,'pump_migration_observed_at_invalid')
  assertIso(input.availableAt,'pump_migration_available_at_invalid')
  if(Date.parse(input.availableAt)<Date.parse(input.observedAt))throw new Error('pump_migration_availability_invalid')
  if(!input.evidenceIds.length)throw new Error('pump_migration_evidence_required')
  assertCount(input.holderCount,'pump_migration_holder_count_invalid')
  assertCount(input.uniqueBuyerCount,'pump_migration_unique_buyer_count_invalid')

  const stage=classifyPumpMigrationStage(input,options.approachingThreshold??0.9)
  const progress=pumpGraduationProgress(input)
  const blockers:string[]=[]
  const missingChecks:string[]=[]

  const creatorRisk=bounded(input.creatorRiskScore)
  const clusterRisk=bounded(input.clusterRiskScore)
  const sniperRisk=bounded(input.sniperInventoryRisk)
  if(input.rugBlocked)blockers.push('rug-protection-block')
  if(creatorRisk!==undefined&&creatorRisk>=0.8)blockers.push('creator-risk-high')
  if(clusterRisk!==undefined&&clusterRisk>=0.8)blockers.push('cluster-risk-high')
  if(sniperRisk!==undefined&&sniperRisk>=0.8)blockers.push('sniper-inventory-risk-high')

  if(input.holderCount===undefined)missingChecks.push('holder-count')
  if(input.uniqueBuyerCount===undefined)missingChecks.push('unique-buyer-count')
  if(input.creatorRiskScore===undefined)missingChecks.push('creator-risk')
  if(input.clusterRiskScore===undefined)missingChecks.push('cluster-risk')
  if(input.sniperInventoryRisk===undefined)missingChecks.push('sniper-inventory-risk')
  if(input.rugBlocked===undefined)missingChecks.push('rug-protection')

  const acceleration=bounded(input.volumeAccelerationScore)??0
  const buyPressure=bounded(input.buyPressureScore)??0
  const holderGrowth=bounded(input.holderGrowthScore)??0
  const lifecycle=stage==='PUMPSWAP_MIGRATED'?1:stage==='CURVE_COMPLETE'?0.95:progress??0
  const holderEvidence=input.holderCount===undefined?0:Math.min(1,Math.log10(input.holderCount+1)/3)
  const buyerEvidence=input.uniqueBuyerCount===undefined?0:Math.min(1,Math.log10(input.uniqueBuyerCount+1)/3)

  const positive=(lifecycle*0.30)+(acceleration*0.20)+(buyPressure*0.15)+(holderGrowth*0.15)+(holderEvidence*0.10)+(buyerEvidence*0.10)
  const penalty=Math.max(creatorRisk??0,clusterRisk??0,sniperRisk??0)
  const discoveryScore=Math.max(0,Math.min(1,positive*(1-0.6*penalty)))
  const disposition=blockers.length?'BLOCK':missingChecks.length?'REVIEW':discoveryScore>=0.65?'WATCH':'REVIEW'

  return Object.freeze({
    candidateId:`pump-migration-radar:${input.observationId}`,
    mint:input.mint,
    stage,
    graduationProgress:progress,
    discoveryScore,
    disposition,
    blockers:Object.freeze([...new Set(blockers)].sort()),
    missingChecks:Object.freeze([...new Set(missingChecks)].sort()),
    observedAt:input.observedAt,
    availableAt:input.availableAt,
    pumpSwapPoolAddress:input.pumpSwapPoolAddress,
    evidenceIds:Object.freeze([...new Set(input.evidenceIds)].sort()),
    authority:'RESEARCH_ONLY',
    canAuthorizeTrade:false,
  })
}
