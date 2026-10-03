import {PUMP_PROGRAM_ID} from './pump-migration-verifier'
import type {PumpMigrationObservation} from './migration-radar'
import {decodeBase58,findSolanaProgramAddress} from './solana-pda'

export const PUMP_BONDING_CURVE_DISCRIMINATOR=Object.freeze([23,183,248,55,96,216,172,96] as const)
export const PUMP_BONDING_CURVE_SEED='bonding-curve' as const

export async function derivePumpBondingCurveAddress(mint:string):Promise<Readonly<{address:string;bump:number}>>{
  const mintBytes=decodeBase58(mint)
  if(mintBytes.length!==32)throw new Error('pump_bonding_curve_mint_invalid')
  return findSolanaProgramAddress([new TextEncoder().encode(PUMP_BONDING_CURVE_SEED),mintBytes],PUMP_PROGRAM_ID)
}

export type PumpBondingCurveState=Readonly<{
  virtualTokenReserves:bigint
  virtualQuoteReserves:bigint
  realTokenReserves:bigint
  realQuoteReserves:bigint
  tokenTotalSupply:bigint
  complete:boolean
  mayhemMode?:boolean
  quoteMint?:string
}>

type FetchLike=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>

const ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const sameBytes=(a:Uint8Array,b:readonly number[])=>a.length>=b.length&&b.every((v,i)=>a[i]===v)

function base58(bytes:Uint8Array):string{
  if(!bytes.length)return ''
  const digits=[0]
  for(const byte of bytes){
    let carry=byte
    for(let i=0;i<digits.length;i++){const n=digits[i]!*256+carry;digits[i]=n%58;carry=Math.floor(n/58)}
    while(carry){digits.push(carry%58);carry=Math.floor(carry/58)}
  }
  let out=''
  for(const byte of bytes){if(byte===0)out+='1';else break}
  for(let i=digits.length-1;i>=0;i--)out+=ALPHABET[digits[i]!]!
  return out
}

function decodeBase64(value:string):Uint8Array{
  const normalized=value.trim()
  if(!normalized)throw new Error('pump_bonding_curve_data_empty')
  if(typeof atob==='function'){
    const binary=atob(normalized)
    return Uint8Array.from(binary,char=>char.charCodeAt(0))
  }
  throw new Error('pump_bonding_curve_base64_unavailable')
}

function u64(data:Uint8Array,offset:number):bigint{
  if(data.length<offset+8)throw new Error('pump_bonding_curve_data_truncated')
  let value=0n
  for(let i=7;i>=0;i--)value=(value<<8n)|BigInt(data[offset+i]!)
  return value
}

const zeroKey=(data:Uint8Array)=>data.every(byte=>byte===0)

export function parsePumpBondingCurveAccount(input:{data:Uint8Array;owner?:string}):PumpBondingCurveState{
  if(input.owner!==undefined&&input.owner!==PUMP_PROGRAM_ID)throw new Error('pump_bonding_curve_owner_invalid')
  const data=input.data
  if(data.length<49)throw new Error('pump_bonding_curve_data_too_short')
  if(!sameBytes(data,PUMP_BONDING_CURVE_DISCRIMINATOR))throw new Error('pump_bonding_curve_discriminator_invalid')

  const state:PumpBondingCurveState={
    virtualTokenReserves:u64(data,8),
    virtualQuoteReserves:u64(data,16),
    realTokenReserves:u64(data,24),
    realQuoteReserves:u64(data,32),
    tokenTotalSupply:u64(data,40),
    complete:data[48]===1,
    ...(data.length>=82?{mayhemMode:data[81]===1}:{}),
    ...(data.length>=115&&!zeroKey(data.slice(83,115))?{quoteMint:base58(data.slice(83,115))}:{}),
  }
  if(data[48]!==0&&data[48]!==1)throw new Error('pump_bonding_curve_complete_invalid')
  if(data.length>=82&&data[81]!==0&&data[81]!==1)throw new Error('pump_bonding_curve_mayhem_invalid')
  return Object.freeze(state)
}

export class PumpBondingCurveRpcSource{
  constructor(private readonly options:Readonly<{
    rpcUrl:string
    fetchImpl?:FetchLike
    now?:()=>string
    commitment?:'processed'|'confirmed'|'finalized'
  }>){
    if(!options.rpcUrl.trim()||!/^https:\/\//i.test(options.rpcUrl))throw new Error('pump_bonding_curve_rpc_url_invalid')
  }

  async observe(input:Readonly<{
    mint:string
    bondingCurveAddress?:string
    initialRealTokenReserves?:bigint
    evidenceIds?:readonly string[]
  }>):Promise<PumpMigrationObservation>{
    if(!input.mint.trim())throw new Error('pump_bonding_curve_rpc_identity_required')
    const bondingCurveAddress=bondingCurveAddress?.trim()|| (await derivePumpBondingCurveAddress(input.mint)).address
    const fetchImpl=this.options.fetchImpl??fetch
    const response=await fetchImpl(this.options.rpcUrl,{
      method:'POST',
      headers:{'content-type':'application/json'},
      cache:'no-store',
      body:JSON.stringify({
        jsonrpc:'2.0',
        id:1,
        method:'getAccountInfo',
        params:[bondingCurveAddress,{encoding:'base64',commitment:this.options.commitment??'confirmed'}],
      }),
    })
    if(!response.ok)throw new Error(`pump_bonding_curve_rpc_http_${response.status}`)
    const body=await response.json() as any
    if(body?.error)throw new Error('pump_bonding_curve_rpc_error')
    const slot=Number(body?.result?.context?.slot)
    const value=body?.result?.value
    if(!value)throw new Error('pump_bonding_curve_account_missing')
    if(value.owner!==PUMP_PROGRAM_ID)throw new Error('pump_bonding_curve_owner_invalid')
    const encoded=Array.isArray(value.data)?value.data[0]:undefined
    if(typeof encoded!=='string')throw new Error('pump_bonding_curve_rpc_data_invalid')
    const state=parsePumpBondingCurveAccount({data:decodeBase64(encoded),owner:value.owner})
    const observedAt=this.options.now?.()??new Date().toISOString()
    if(Number.isNaN(Date.parse(observedAt)))throw new Error('pump_bonding_curve_rpc_clock_invalid')
    const evidenceIds=[...new Set([
      ...(input.evidenceIds??[]),
      `solana-account:${bondingCurveAddress}`,
      ...(Number.isSafeInteger(slot)&&slot>=0?[`solana-slot:${slot}`]:[]),
    ])].sort()
    return Object.freeze({
      observationId:`pump-curve:${bondingCurveAddress}:${Number.isSafeInteger(slot)&&slot>=0?slot:observedAt}`,
      mint:input.mint,
      quoteMint:state.quoteMint,
      bondingCurveAddress:bondingCurveAddress,
      mayhemMode:state.mayhemMode,
      observedAt,
      availableAt:observedAt,
      initialRealTokenReserves:input.initialRealTokenReserves,
      realTokenReserves:state.realTokenReserves,
      complete:state.complete,
      evidenceIds:Object.freeze(evidenceIds),
    })
  }
}
