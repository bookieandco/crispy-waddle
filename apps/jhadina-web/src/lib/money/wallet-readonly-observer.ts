import {createHash} from 'node:crypto'
import {decodeSolanaPublicKey} from './phantom-ownership-proof'

/** Owner-wallet observation is never a Coffer asset, signer, balance authority,
 * settled P&L, or SHARK trade permit. It is bounded public-chain research.
 */
export type OwnerWalletChainObservation=Readonly<{
 version:'JH-WALLET.08'
 address:string
 observedAt:string
 source:'SOLANA_MAINNET_RPC'
 commitment:'confirmed'
 balanceLamports:string
 balanceSlot:number
 recentTransactions:readonly Readonly<{
  signature:string
  slot:number
  blockTime:number|null
  failed:boolean
 }>[]
 evidenceId:string
 authority:'OBSERVATION_ONLY'
 canSign:false
 canTrade:false
 canMoveFunds:false
 canCreditPurse:false
}>

const MAX_TX=10
const MAX_RESPONSE_BYTES=100_000
const BASE58=/^[1-9A-HJ-NP-Za-km-z]+$/
const record=(x:unknown):Record<string,unknown>|null=>
 x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:null
const integer=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0

/** Fixed public endpoint is an explicitly rate-limited development fallback.
 * Production should set a server-side, read-only SOLANA_RPC_URL. */
export function walletReadRpcUrl(configured?:string):string{
 const url=new URL(configured?.trim()||'https://api.mainnet.solana.com')
 if(url.protocol!=='https:'||url.username||url.password||url.hash){
  throw new Error('WALLET_OBSERVER_RPC_URL_INVALID')
 }
 return url.toString()
}

async function rpc(endpoint:string,method:'getBalance'|'getSignaturesForAddress',
 params:unknown[],fetchImpl:typeof fetch):Promise<unknown>{
 const res=await fetchImpl(endpoint,{
  method:'POST',
  headers:{'content-type':'application/json','accept':'application/json'},
  cache:'no-store',
  signal:AbortSignal.timeout(8000),
  body:JSON.stringify({jsonrpc:'2.0',id:method,method,params}),
 })
 if(!res.ok)throw new Error('WALLET_OBSERVER_RPC_UNAVAILABLE')
 const body=await res.text()
 if(body.length>MAX_RESPONSE_BYTES)throw new Error('WALLET_OBSERVER_RPC_RESPONSE_TOO_LARGE')
 let parsed:unknown
 try{parsed=JSON.parse(body)}catch{throw new Error('WALLET_OBSERVER_RPC_RESPONSE_INVALID')}
 const envelope=record(parsed)
 if(!envelope||envelope.jsonrpc!=='2.0'||envelope.id!==method||envelope.error||!('result' in envelope)){
  throw new Error('WALLET_OBSERVER_RPC_RESPONSE_INVALID')
 }
 return envelope.result
}

export async function observeOwnerSolanaWallet(input:{
 address:string
 rpcUrl?:string
 fetchImpl?:typeof fetch
 now?:()=>Date
}):Promise<OwnerWalletChainObservation>{
 decodeSolanaPublicKey(input.address)
 const endpoint=walletReadRpcUrl(input.rpcUrl)
 const fetchImpl=input.fetchImpl??fetch
 // Only two fixed read methods and a server-selected, verified public key.
 const [balanceValue,activityValue]=await Promise.all([
  rpc(endpoint,'getBalance',[input.address,{commitment:'confirmed'}],fetchImpl),
  rpc(endpoint,'getSignaturesForAddress',[input.address,{limit:MAX_TX,commitment:'confirmed'}],fetchImpl),
 ])
 const balance=record(balanceValue),context=record(balance?.context)
 if(!integer(context?.slot)||!integer(balance?.value)){
  throw new Error('WALLET_OBSERVER_BALANCE_INVALID')
 }
 if(!Array.isArray(activityValue)||activityValue.length>MAX_TX){
  throw new Error('WALLET_OBSERVER_ACTIVITY_INVALID')
 }
 const activity=activityValue.map((item:unknown)=>{
  const row=record(item)
  const signature=row?.signature
  if(typeof signature!=='string'||signature.length<80||signature.length>90||!BASE58.test(signature)||
     !integer(row?.slot)||!(row?.blockTime===null||row?.blockTime===undefined||integer(row?.blockTime))){
   throw new Error('WALLET_OBSERVER_ACTIVITY_INVALID')
  }
  return Object.freeze({
   signature,slot:row.slot as number,blockTime:(row.blockTime??null) as number|null,
   failed:row.err!==null&&row.err!==undefined,
  })
 })
 const observedAt=(input.now?.()??new Date()).toISOString()
 const digest=createHash('sha256').update(JSON.stringify({
  address:input.address,slot:context.slot,balance:balance.value,activity,
 })).digest('hex')
 return Object.freeze({
  version:'JH-WALLET.08',address:input.address,observedAt,
  source:'SOLANA_MAINNET_RPC',commitment:'confirmed',
  balanceLamports:String(balance.value),balanceSlot:context.slot as number,
  recentTransactions:Object.freeze(activity),evidenceId:'wallet:solana-rpc:'+digest,
  authority:'OBSERVATION_ONLY',canSign:false,canTrade:false,
  canMoveFunds:false,canCreditPurse:false,
 })
}

/** SHARK/Shadow Learn may analyze the existence/timing of observed activity.
 * The RPC snapshot does not establish position cost basis or realized profits.
 * Explicitly no persistence or execution is performed here. */
export function toShadowWalletResearch(observation:OwnerWalletChainObservation){
 return Object.freeze({
  version:'JH-WALLET.SHADOW.09' as const,
  evidenceId:observation.evidenceId,
  walletAddress:observation.address,
  chain:'solana' as const,
  observedAt:observation.observedAt,
  availableAt:observation.observedAt,
  evidenceClassification:'RPC_REPORTED_READ_ONLY' as const,
  recentSignatureCount:observation.recentTransactions.length,
  failedSignatureCount:observation.recentTransactions.filter(x=>x.failed).length,
  source:'MONEY_OWNER_WALLET' as const,
  authority:'SHADOW_RESEARCH_ONLY' as const,
  containsPortfolioCostBasis:false as const,
  containsSettledPnl:false as const,
  canSign:false as const,canExecute:false as const,
  canCreditPurse:false as const,canAuthorizeLive:false as const,
 })
}
