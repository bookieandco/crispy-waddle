import { createHash } from "node:crypto"
import { NextRequest,NextResponse } from "next/server"
import {
  MONEY_STRATEGY_LANES,
  validateMoneyOwnerCommissioning,
  type MoneyOwnerCommissioning,
  type MoneyStrategyLane,
} from "@jhadina/money-core"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic="force-dynamic"

async function verifiedUserId(){
 const client=await createClient()
 const {data,error}=await client.auth.getClaims()
 const id=data?.claims?.sub
 if(error||!id)throw new Error("MONEY_COMMISSION2_SESSION_REQUIRED")
 return id
}
function admin(){
 const client=createServiceRoleClient()
 if(!client)throw new Error("MONEY_PRIVATE_STORE_NOT_CONFIGURED")
 return client
}
function bigintField(body:Record<string,unknown>,key:string){
 const v=String(body[key]??"").trim()
 if(!/^\d+$/.test(v))throw new Error("MONEY_COMMISSION2_"+key.toUpperCase()+"_INVALID")
 return BigInt(v)
}
function intField(body:Record<string,unknown>,key:string){
 const v=Number(body[key])
 if(!Number.isInteger(v))throw new Error("MONEY_COMMISSION2_"+key.toUpperCase()+"_INVALID")
 return v
}
function cofferIdFor(userId:string){
 return "coffer:"+createHash("sha256").update("jhadina-money:"+userId).digest("hex").slice(0,32)
}
function lane(value:unknown):MoneyStrategyLane{
 if(typeof value!=="string"||!MONEY_STRATEGY_LANES.includes(value as MoneyStrategyLane))throw new Error("MONEY_COMMISSION2_STRATEGY_LANE_INVALID")
 return value as MoneyStrategyLane
}

export async function POST(req:NextRequest){
 try{
  const userId=await verifiedUserId()
  const body=await req.json() as Record<string,unknown>
  const rawStrategies=Array.isArray(body.strategies)?body.strategies:[]
  const config:MoneyOwnerCommissioning=Object.freeze({
   currency:String(body.currency??"USD").trim().toUpperCase(),
   principalCapitalMinor:bigintField(body,"principalCapitalMinor"),
   hardStopFloorMinor:bigintField(body,"hardStopFloorMinor"),
   survivalFloorMinor:bigintField(body,"survivalFloorMinor"),
   defensiveFloorMinor:bigintField(body,"defensiveFloorMinor"),
   maxDeployableBps:intField(body,"maxDeployableBps"),
   profitSweepThresholdMinor:bigintField(body,"profitSweepThresholdMinor"),
   profitRetainMinor:bigintField(body,"profitRetainMinor"),
   planningReserveBps:intField(body,"planningReserveBps"),
   profitSweepEnabled:Boolean(body.profitSweepEnabled),
   strategies:Object.freeze(rawStrategies.map((raw)=>{
    const x=(raw??{}) as Record<string,unknown>
    return Object.freeze({lane:lane(x.lane),allocatedMinor:BigInt(String(x.allocatedMinor??"0")),hardCapMinor:BigInt(String(x.hardCapMinor??"0"))})
   })),
   authority:"OWNER_CONFIGURATION" as const,
   canFund:false as const,
   canTrade:false as const,
  })
  const validation=validateMoneyOwnerCommissioning(config)
  const db=admin(),now=new Date().toISOString(),cofferId=cofferIdFor(userId)
  const {data:existing,error:existingError}=await db.from("money_coffers").select("coffer_id,state").eq("user_id",userId).order("updated_at",{ascending:false}).limit(1).maybeSingle()
  if(existingError)throw new Error("MONEY_COMMISSION2_COFFER_LOOKUP_FAILED:"+existingError.message)
  const actualCofferId=existing?.coffer_id??cofferId
  const cofferState=existing?.state??"RECAPITALIZATION_REQUIRED"
  const {error:cofferError}=await db.from("money_coffers").upsert({
   coffer_id:actualCofferId,user_id:userId,currency:config.currency,
   principal_capital_minor:config.principalCapitalMinor.toString(),
   hard_stop_floor_minor:config.hardStopFloorMinor.toString(),
   survival_floor_minor:config.survivalFloorMinor.toString(),
   defensive_floor_minor:config.defensiveFloorMinor.toString(),
   max_deployable_bps:config.maxDeployableBps,
   state:cofferState,updated_at:now,
  },{onConflict:"coffer_id"})
  if(cofferError)throw new Error("MONEY_COMMISSION2_COFFER_STORE_FAILED:"+cofferError.message)

  const {data:existingSweep,error:sweepLookupError}=await db.from("money_profit_sweep_policies").select("verified_owner_destination_id,standing_mandate_id").eq("coffer_id",actualCofferId).maybeSingle()
  if(sweepLookupError)throw new Error("MONEY_COMMISSION2_SWEEP_LOOKUP_FAILED:"+sweepLookupError.message)
  const {error:sweepError}=await db.from("money_profit_sweep_policies").upsert({
   coffer_id:actualCofferId,
   threshold_minor:config.profitSweepThresholdMinor.toString(),
   retain_minor:config.profitRetainMinor.toString(),
   planning_reserve_bps:config.planningReserveBps,
   enabled:config.profitSweepEnabled,
   verified_owner_destination_id:existingSweep?.verified_owner_destination_id??null,
   standing_mandate_id:existingSweep?.standing_mandate_id??null,
   updated_at:now,
  },{onConflict:"coffer_id"})
  if(sweepError)throw new Error("MONEY_COMMISSION2_SWEEP_STORE_FAILED:"+sweepError.message)

  const {data:existingBudgets,error:existingBudgetError}=await db.from("money_strategy_budgets").select("lane,reserved_minor,spent_minor,evidence_ids").eq("coffer_id",actualCofferId)
  if(existingBudgetError)throw new Error("MONEY_COMMISSION2_BUDGET_LOOKUP_FAILED:"+existingBudgetError.message)
  const priorByLane=new Map((existingBudgets??[]).map(x=>[String(x.lane),x]))
  const configured=new Map(config.strategies.map(s=>[s.lane,s]))
  const budgetRows=MONEY_STRATEGY_LANES.map((strategyLane)=>{
   const s=configured.get(strategyLane)??{lane:strategyLane,allocatedMinor:0n,hardCapMinor:0n}
   const prior=priorByLane.get(strategyLane)
   const reserved=BigInt(String(prior?.reserved_minor??"0"))
   const spent=BigInt(String(prior?.spent_minor??"0"))
   const used=reserved+spent
   if(s.allocatedMinor<used||s.hardCapMinor<used)throw new Error("MONEY_COMMISSION2_BUDGET_BELOW_CURRENT_EXPOSURE:"+strategyLane)
   const effectiveCap=s.allocatedMinor<s.hardCapMinor?s.allocatedMinor:s.hardCapMinor
   const state=cofferState!=="ACTIVE"?"HALTED":effectiveCap<=used?"EXHAUSTED":s.allocatedMinor>0n?"ACTIVE":"HALTED"
   return {
    budget_id:actualCofferId+":"+strategyLane.toLowerCase(),
    coffer_id:actualCofferId,
    strategy_id:strategyLane.toLowerCase(),
    lane:strategyLane,
    currency:config.currency,
    allocated_minor:s.allocatedMinor.toString(),
    reserved_minor:reserved.toString(),
    spent_minor:spent.toString(),
    hard_cap_minor:s.hardCapMinor.toString(),
    state,
    evidence_ids:[...(prior?.evidence_ids??[]),"owner-commissioning:"+now],
    updated_at:now,
   }
  })
  const {error:budgetError}=await db.from("money_strategy_budgets").upsert(budgetRows,{onConflict:"coffer_id,strategy_id,lane"})
  if(budgetError)throw new Error("MONEY_COMMISSION2_BUDGET_STORE_FAILED:"+budgetError.message)

  return NextResponse.json({success:true,data:{
   cofferId:actualCofferId,
   state:cofferState,
   totalAllocatedMinor:validation.totalAllocatedMinor.toString(),
   unallocatedMinor:validation.unallocatedMinor.toString(),
   fundingRequired:cofferState==="RECAPITALIZATION_REQUIRED",
   canFund:false,
   canTrade:false,
  }})
 }catch(error){
  const message=error instanceof Error?error.message:"Money commissioning failed"
  const status=message.includes("SESSION")?401:message.includes("INVALID")||message.includes("EXCEED")||message.includes("REQUIRED")||message.includes("DUPLICATE")||message.includes("BELOW_CURRENT_EXPOSURE")?400:500
  return NextResponse.json({success:false,error:message},{status})
 }
}
