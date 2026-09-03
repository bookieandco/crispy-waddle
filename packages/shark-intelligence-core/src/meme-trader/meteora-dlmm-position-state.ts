export type DlmmPositionState = {
  positionAddress: string
  poolAddress: string
  owner?: string
  operator?: string
  lowerBinId?: number
  upperBinId?: number
  activeBinId?: number
  lifecycle: 'UNKNOWN' | 'OPEN' | 'ACTIVE' | 'CLOSED'
  liquidityState: 'UNKNOWN' | 'FUNDED' | 'PARTIAL' | 'EMPTY'
  tokenXRaw: bigint
  tokenYRaw: bigint
  openedAt?: string
  lastObservedAt: string
  evidenceIds: string[]
}

export type DlmmPositionTransition = {
  eventId: string
  signature: string
  positionAddress: string
  poolAddress: string
  tokenMint?: string
  action: 'OPEN' | 'ADD' | 'REMOVE' | 'REBALANCE' | 'CLAIM_FEE' | 'CLOSE'
  owner?: string
  operator?: string
  fromBinId?: number
  toBinId?: number
  activeBinId?: number
  removedBps?: number
  oneSided?: boolean
  tokenXDeltas?: bigint
  tokenYDeltas?: bigint
  tokenXWithdrawnRaw?: bigint
  tokenXAddedRaw?: bigint
  tokenYWithdrawnRaw?: bigint
  tokenYAddedRaw?: bigint
  observedAt: string
  evidenceIds: string[]
  confidence: number
  semantic: 'EXPLICIT' | 'INFERRED'
}

export type DlmmPositionTransitionResult = { state?: DlmmPositionState; withdrawal?: DlmmPositionTransition; rejected?: string }
const validTimestamp=(v:string)=>Number.isFinite(Date.parse(v))
const validBin=(v?:number)=>v===undefined||Number.isInteger(v)
const validBps=(v?:number)=>v===undefined||(Number.isInteger(v)&&v>=0&&v<=10000)
const nonNegative=(v?:bigint)=>v===undefined||v>=0n
function liquidityState(x:bigint,y:bigint):DlmmPositionState['liquidityState']{if(x<0n||y<0n)return'UNKNOWN';if(x===0n&&y===0n)return'EMPTY';return x>0n&&y>0n?'FUNDED':'PARTIAL'}
const mergeEvidence=(a:string[],b:string[])=>[...new Set([...a,...b])]

export function applyDlmmPositionTransition(current:DlmmPositionState|undefined,t:DlmmPositionTransition):DlmmPositionTransitionResult{
  if(!t.eventId||!t.signature||!t.positionAddress||!t.poolAddress)return{rejected:'INVALID_IDENTITY'}
  if(!validTimestamp(t.observedAt))return{rejected:'INVALID_TIMESTAMP'}
  if(t.evidenceIds.length===0)return{rejected:'MISSING_EVIDENCE'}
  if(!Number.isFinite(t.confidence)||t.confidence<0||t.confidence>1)return{rejected:'INVALID_CONFIDENCE'}
  if(!validBps(t.removedBps)||!validBin(t.fromBinId)||!validBin(t.toBinId)||!validBin(t.activeBinId))return{rejected:'INVALID_RANGE'}
  if(!nonNegative(t.tokenXDeltas)||!nonNegative(t.tokenYDeltas)||!nonNegative(t.tokenXWithdrawnRaw)||!nonNegative(t.tokenXAddedRaw)||!nonNegative(t.tokenYWithdrawnRaw)||!nonNegative(t.tokenYAddedRaw))return{rejected:'NEGATIVE_DELTA'}
  if(current&&Date.parse(t.observedAt)<Date.parse(current.lastObservedAt))return{rejected:'STATE_REGRESSION'}
  if(t.action!=='OPEN'&&!current)return{rejected:'MISSING_OPEN'}
  if(t.action==='OPEN'){
    if(current)return{rejected:'DUPLICATE_OPEN'}
    const x=t.tokenXDeltas??0n,y=t.tokenYDeltas??0n
    return{state:{positionAddress:t.positionAddress,poolAddress:t.poolAddress,owner:t.owner,operator:t.operator,lowerBinId:t.fromBinId,upperBinId:t.toBinId,activeBinId:t.activeBinId,lifecycle:x>0n||y>0n?'ACTIVE':'OPEN',liquidityState:liquidityState(x,y),tokenXRaw:x,tokenYRaw:y,openedAt:t.observedAt,lastObservedAt:t.observedAt,evidenceIds:[...new Set(t.evidenceIds)]}}
  }
  if(!current)return{rejected:'MISSING_STATE'}
  if(current.poolAddress!==t.poolAddress)return{rejected:'POOL_MISMATCH'}
  if(current.positionAddress!==t.positionAddress)return{rejected:'POSITION_MISMATCH'}
  if(current.lifecycle==='CLOSED'&&t.action!=='CLAIM_FEE')return{rejected:'CLOSED_POSITION'}
  let x=current.tokenXRaw,y=current.tokenYRaw,lifecycle=current.lifecycle,lower=current.lowerBinId,upper=current.upperBinId,active=current.activeBinId
  const xd=t.tokenXDeltas??0n,yd=t.tokenYDeltas??0n
  if(t.action==='ADD'){x+=xd;y+=yd;lifecycle='ACTIVE'}
  else if(t.action==='REMOVE'){if(xd>x||yd>y)return{rejected:'LIQUIDITY_UNDERFLOW'};x-=xd;y-=yd;lifecycle=x===0n&&y===0n?'OPEN':'ACTIVE'}
  else if(t.action==='REBALANCE'){
    const xw=t.tokenXWithdrawnRaw??0n,xa=t.tokenXAddedRaw??0n,yw=t.tokenYWithdrawnRaw??0n,ya=t.tokenYAddedRaw??0n
    if(xw>x+xa||yw>y+ya)return{rejected:'REBALANCE_UNDERFLOW'}
    x=x-xw+xa;y=y-yw+ya;lower=t.fromBinId??lower;upper=t.toBinId??upper;active=t.activeBinId??active;lifecycle=x===0n&&y===0n?'OPEN':'ACTIVE'
  } else if(t.action==='CLOSE'){if(x!==0n||y!==0n)return{rejected:'CLOSE_WITH_LIQUIDITY'};lifecycle='CLOSED'}
  return{state:{...current,owner:t.owner??current.owner,operator:t.operator??current.operator,lowerBinId:lower,upperBinId:upper,activeBinId:active,lifecycle,liquidityState:liquidityState(x,y),tokenXRaw:x,tokenYRaw:y,lastObservedAt:t.observedAt,evidenceIds:mergeEvidence(current.evidenceIds,t.evidenceIds)},withdrawal:t.action==='REMOVE'?t:undefined}
}
