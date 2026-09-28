import "server-only"
import { createHash } from "node:crypto"
import { createClient } from "../supabase/server"
import { createServiceRoleClient } from "../supabase/service-role"

type RpcEnvelope={result?:unknown;error?:unknown}
type FundingVerification=Readonly<{
 verified:boolean
 walletConnectionId:string
 settlementMint:string
 settlementObservedAtomic:string
 settlementMinimumAtomic:string
 solObservedLamports:string
 solMinimumLamports:string
 blockerCodes:readonly string[]
 evidenceIds:readonly string[]
 authority:"FUNDING_EVIDENCE_ONLY"
}>

async function verifiedUserId(){
 const client=await createClient()
 const {data,error}=await client.auth.getClaims()
 const id=data?.claims?.sub
 if(error||!id)throw new Error("DEX_FUNDING_SESSION_REQUIRED")
 return id
}
function admin(){
 const client=createServiceRoleClient()
 if(!client)throw new Error("DEX_FUNDING_PRIVATE_STORE_NOT_CONFIGURED")
 return client
}
function env(name:string):string{
 const value=process.env[name]?.trim()
 if(!value)throw new Error("DEX_FUNDING_"+name+"_REQUIRED")
 return value
}
function positiveAtomic(name:string):bigint{
 const value=env(name)
 if(!/^\d+$/.test(value)||BigInt(value)<=0n)throw new Error("DEX_FUNDING_"+name+"_INVALID")
 return BigInt(value)
}
function record(value:unknown):Record<string,unknown>|undefined{
 return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:undefined
}
async function rpc(endpoint:string,method:string,params:unknown[]):Promise<unknown>{
 const response=await fetch(endpoint,{
  method:"POST",
  headers:{"content-type":"application/json","accept":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),
  cache:"no-store",
 })
 if(!response.ok)throw new Error("DEX_FUNDING_RPC_HTTP_"+response.status)
 const payload=await response.json() as RpcEnvelope
 if(payload.error)throw new Error("DEX_FUNDING_RPC_ERROR")
 return payload.result
}
function tokenAmountFromAccounts(result:unknown):Readonly<{amount:bigint;slot:number}>{
 const root=record(result)
 const context=record(root?.context)
 const slot=typeof context?.slot==="number"&&Number.isSafeInteger(context.slot)?context.slot:0
 const rows=Array.isArray(root?.value)?root.value:[]
 let amount=0n
 for(const row of rows){
  const account=record(record(row)?.account)
  const data=record(account?.data)
  const parsed=record(data?.parsed)
  const info=record(parsed?.info)
  const tokenAmount=record(info?.tokenAmount)
  const raw=tokenAmount?.amount
  if(typeof raw==="string"&&/^\d+$/.test(raw))amount+=BigInt(raw)
 }
 return Object.freeze({amount,slot})
}
function solAmount(result:unknown):Readonly<{amount:bigint;slot:number}>{
 const root=record(result)
 const context=record(root?.context)
 const slot=typeof context?.slot==="number"&&Number.isSafeInteger(context.slot)?context.slot:0
 const value=root?.value
 if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0)throw new Error("DEX_FUNDING_SOL_BALANCE_INVALID")
 return Object.freeze({amount:BigInt(value),slot})
}
function id(value:unknown){
 return createHash("sha256").update(JSON.stringify(value,(_,x)=>typeof x==="bigint"?x.toString():x)).digest("hex")
}

export async function verifyDexCanaryFunding():Promise<FundingVerification>{
 const userId=await verifiedUserId()
 const db=admin()
 const rpcEndpoint=env("SOLANA_RPC_URL")
 if(!rpcEndpoint.startsWith("https://"))throw new Error("DEX_FUNDING_SOLANA_RPC_HTTPS_REQUIRED")
 const settlementMint=env("MONEY_DEX_SETTLEMENT_MINT")
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(settlementMint))throw new Error("DEX_FUNDING_SETTLEMENT_MINT_INVALID")
 const settlementMinimum=positiveAtomic("MONEY_DEX_CANARY_MIN_SETTLEMENT_ATOMIC")
 const solMinimum=positiveAtomic("MONEY_DEX_CANARY_MIN_SOL_LAMPORTS")

 const {data:wallet,error}=await db.from("money_wallet_connections")
  .select("connection_id,address,evidence_ids")
  .eq("user_id",userId)
  .eq("network","SOLANA")
  .eq("mode","COFFER_EXECUTION_WALLET")
  .eq("status","ACTIVE")
  .order("updated_at",{ascending:false})
  .limit(1)
  .maybeSingle()
 if(error)throw new Error("DEX_FUNDING_WALLET_READ_FAILED:"+error.message)
 if(!wallet)throw new Error("DEX_FUNDING_COFFER_WALLET_REQUIRED")

 const [settlementResult,solResult]=await Promise.all([
  rpc(rpcEndpoint,"getTokenAccountsByOwner",[wallet.address,{mint:settlementMint},{encoding:"jsonParsed",commitment:"confirmed"}]),
  rpc(rpcEndpoint,"getBalance",[wallet.address,{commitment:"confirmed"}]),
 ])
 const settlement=tokenAmountFromAccounts(settlementResult)
 const sol=solAmount(solResult)
 const blockers:string[]=[]
 if(settlement.amount<settlementMinimum)blockers.push("DEX_FUNDING_SETTLEMENT_BALANCE_TOO_LOW")
 if(sol.amount<solMinimum)blockers.push("DEX_FUNDING_SOL_FEE_RESERVE_TOO_LOW")
 const verified=blockers.length===0
 if(!verified)return Object.freeze({
  verified:false,walletConnectionId:wallet.connection_id,settlementMint,
  settlementObservedAtomic:settlement.amount.toString(),settlementMinimumAtomic:settlementMinimum.toString(),
  solObservedLamports:sol.amount.toString(),solMinimumLamports:solMinimum.toString(),
  blockerCodes:Object.freeze(blockers),evidenceIds:Object.freeze([]),authority:"FUNDING_EVIDENCE_ONLY" as const,
 })

 const observedAt=new Date().toISOString()
 const settlementObservation="solana:token-balance:"+id({wallet:wallet.address,mint:settlementMint,slot:settlement.slot,amount:settlement.amount})
 const solObservation="solana:balance:"+id({wallet:wallet.address,slot:sol.slot,amount:sol.amount})
 const rows=[
  {
   funding_evidence_id:"dex-funding:"+id({userId,wallet:wallet.connection_id,asset:settlementMint,observation:settlementObservation}),
   user_id:userId,wallet_connection_id:wallet.connection_id,asset_id:settlementMint,amount_atomic:settlement.amount.toString(),verified:true,
   rpc_observation_id:settlementObservation,observed_at:observedAt,evidence_ids:[...(wallet.evidence_ids??[]),settlementObservation],
  },
  {
   funding_evidence_id:"dex-funding:"+id({userId,wallet:wallet.connection_id,asset:"SOL",observation:solObservation}),
   user_id:userId,wallet_connection_id:wallet.connection_id,asset_id:"SOL",amount_atomic:sol.amount.toString(),verified:true,
   rpc_observation_id:solObservation,observed_at:observedAt,evidence_ids:[...(wallet.evidence_ids??[]),solObservation],
  },
 ]
 const {error:writeError}=await db.from("money_dex_canary_funding_evidence").upsert(rows,{onConflict:"funding_evidence_id"})
 if(writeError)throw new Error("DEX_FUNDING_EVIDENCE_WRITE_FAILED:"+writeError.message)
 return Object.freeze({
  verified:true,walletConnectionId:wallet.connection_id,settlementMint,
  settlementObservedAtomic:settlement.amount.toString(),settlementMinimumAtomic:settlementMinimum.toString(),
  solObservedLamports:sol.amount.toString(),solMinimumLamports:solMinimum.toString(),
  blockerCodes:Object.freeze([]),
  evidenceIds:Object.freeze([rows[0].funding_evidence_id,rows[1].funding_evidence_id,settlementObservation,solObservation]),
  authority:"FUNDING_EVIDENCE_ONLY" as const,
 })
}
