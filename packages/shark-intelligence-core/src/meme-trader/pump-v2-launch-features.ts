export type PumpLaunchObservationKind='CREATE_V2'|'CREATE_EVENT'|'BONDING_CURVE_STATE'|'PUMPSWAP_POOL_STATE'

export type PumpLaunchFeatureEvidence=Readonly<{
  observationKind:PumpLaunchObservationKind
  observedAt:string
  evidenceIds:readonly string[]
  isHolderReward?:boolean
  isCashbackCoin?:boolean
  mayhemMode?:boolean
  quoteMint?:string
  creatorFeeBps?:number
  creatorArgument?:string
  recordedCreator?:string
}>

export type PumpLaunchFeatures=Readonly<{
  protocol:'PUMP'
  interfaceVersion:'PUMP_2'
  holderReward:'ENABLED'|'DISABLED'|'UNKNOWN'
  cashback:'LEGACY_ENABLED'|'DISABLED'|'UNKNOWN'
  mayhemMode:'ENABLED'|'DISABLED'|'UNKNOWN'
  quoteMint?:string
  creatorFeeBps?:number
  creatorArgument?:string
  recordedCreator?:string
  creatorFeeRecipientSemantics:'CREATOR_ADDRESS'|'HOLDER_REWARDS_PROTOCOL'|'UNKNOWN'
  creatorMismatchIsRiskSignal:false
  evidenceIds:readonly string[]
  observedAt:string
}>

const boolState=(value:boolean|undefined):'ENABLED'|'DISABLED'|'UNKNOWN'=>value===true?'ENABLED':value===false?'DISABLED':'UNKNOWN'
const assertIso=(value:string)=>{if(!value||Number.isNaN(Date.parse(value)))throw new Error('pump_launch_feature_timestamp_invalid')}

export function normalizePumpLaunchFeatures(input:PumpLaunchFeatureEvidence):PumpLaunchFeatures{
  assertIso(input.observedAt)
  if(!input.evidenceIds.length)throw new Error('pump_launch_feature_evidence_required')
  if(input.creatorFeeBps!==undefined&&(!Number.isInteger(input.creatorFeeBps)||input.creatorFeeBps<0||input.creatorFeeBps>10000))throw new Error('pump_launch_creator_fee_bps_invalid')
  if(input.observationKind==='CREATE_V2'&&input.isCashbackCoin===true)throw new Error('pump_create_v2_cashback_deprecated')
  const holderReward=boolState(input.isHolderReward)
  const cashback=input.isCashbackCoin===true?'LEGACY_ENABLED':input.isCashbackCoin===false?'DISABLED':'UNKNOWN'
  return Object.freeze({
    protocol:'PUMP',
    interfaceVersion:'PUMP_2',
    holderReward,
    cashback,
    mayhemMode:boolState(input.mayhemMode),
    quoteMint:input.quoteMint,
    creatorFeeBps:input.creatorFeeBps,
    creatorArgument:input.creatorArgument,
    recordedCreator:input.recordedCreator,
    creatorFeeRecipientSemantics:holderReward==='ENABLED'?'HOLDER_REWARDS_PROTOCOL':holderReward==='DISABLED'?'CREATOR_ADDRESS':'UNKNOWN',
    // Pump 2 holder rewards deliberately replace the fee recipient semantics.
    // A creator-address mismatch is therefore not, by itself, a fraud/rug signal.
    creatorMismatchIsRiskSignal:false,
    evidenceIds:Object.freeze([...new Set(input.evidenceIds)].sort()),
    observedAt:input.observedAt,
  })
}

export function mergePumpLaunchFeatures(values:readonly PumpLaunchFeatures[]):PumpLaunchFeatures|undefined{
  if(!values.length)return undefined
  const ordered=[...values].sort((a,b)=>a.observedAt.localeCompare(b.observedAt))
  const latest=ordered[ordered.length-1]!
  const choose=<T>(items:readonly T[],unknown:T)=>[...items].reverse().find(v=>v!==unknown)??unknown
  return Object.freeze({
    ...latest,
    holderReward:choose(ordered.map(v=>v.holderReward),'UNKNOWN' as const),
    cashback:choose(ordered.map(v=>v.cashback),'UNKNOWN' as const),
    mayhemMode:choose(ordered.map(v=>v.mayhemMode),'UNKNOWN' as const),
    quoteMint:[...ordered].reverse().find(v=>v.quoteMint)?.quoteMint,
    creatorFeeBps:[...ordered].reverse().find(v=>v.creatorFeeBps!==undefined)?.creatorFeeBps,
    creatorArgument:[...ordered].reverse().find(v=>v.creatorArgument)?.creatorArgument,
    recordedCreator:[...ordered].reverse().find(v=>v.recordedCreator)?.recordedCreator,
    creatorFeeRecipientSemantics:choose(ordered.map(v=>v.creatorFeeRecipientSemantics),'UNKNOWN' as const),
    evidenceIds:Object.freeze([...new Set(ordered.flatMap(v=>v.evidenceIds))].sort()),
  })
}
