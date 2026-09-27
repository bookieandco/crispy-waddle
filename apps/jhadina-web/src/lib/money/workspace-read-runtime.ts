import "server-only"
import { createClient } from "../supabase/server"
import { createServiceRoleClient } from "../supabase/service-role"

export type MoneyWorkspaceSnapshot=Readonly<{
 userId:string
 coffer:null|Readonly<{
  cofferId:string
  currency:string
  principalCapitalMinor:string
  hardStopFloorMinor:string
  survivalFloorMinor:string
  defensiveFloorMinor:string
  state:"ACTIVE"|"DEFENSIVE"|"SURVIVAL"|"HALTED"|"RECAPITALIZATION_REQUIRED"
 }>
 sweepPolicy:null|Readonly<{
  thresholdMinor:string
  retainMinor:string
  planningReserveBps:number
  enabled:boolean
  verifiedOwnerDestinationId:string|null
  standingMandateId:string|null
 }>
 wallets:readonly Readonly<{
  connectionId:string
  provider:string
  network:string
  address:string
  mode:"OWNER_WALLET"|"COFFER_EXECUTION_WALLET"
  status:"ACTIVE"|"DISCONNECTED"|"REVOKED"
 }>[]
 connectors:readonly Readonly<{
  connectorId:string
  provider:string
  lane:"STOCK"|"FOREX"|"DEX"
  admission:"UNCOMMISSIONED"|"READ_ONLY"|"SHADOW"|"CONTROLLED_CANARY"|"LIVE"
 }>[]
}>

async function verifiedUserId(){
 const client=await createClient()
 const {data,error}=await client.auth.getClaims()
 const id=data?.claims?.sub
 if(error||!id)throw new Error("MONEY_WORKSPACE_SESSION_REQUIRED")
 return id
}

function admin(){
 const client=createServiceRoleClient()
 if(!client)throw new Error("MONEY_PRIVATE_STORE_NOT_CONFIGURED")
 return client
}

export async function readSessionMoneyWorkspace():Promise<MoneyWorkspaceSnapshot>{
 const userId=await verifiedUserId()
 const db=admin()
 const [cofferResult,walletResult,connectorResult]=await Promise.all([
  db.from("money_coffers").select("coffer_id,currency,principal_capital_minor,hard_stop_floor_minor,survival_floor_minor,defensive_floor_minor,state").eq("user_id",userId).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
  db.from("money_wallet_connections").select("connection_id,provider,network,address,mode,status").eq("user_id",userId).order("updated_at",{ascending:false}),
  db.from("money_market_connector_admissions").select("connector_id,provider,lane,admission").order("updated_at",{ascending:false}),
 ])
 if(cofferResult.error)throw new Error("MONEY_WORKSPACE_COFFER_READ_FAILED:"+cofferResult.error.message)
 if(walletResult.error)throw new Error("MONEY_WORKSPACE_WALLET_READ_FAILED:"+walletResult.error.message)
 if(connectorResult.error)throw new Error("MONEY_WORKSPACE_CONNECTOR_READ_FAILED:"+connectorResult.error.message)
 let sweepPolicy:MoneyWorkspaceSnapshot["sweepPolicy"]=null
 if(cofferResult.data?.coffer_id){
  const {data,error}=await db.from("money_profit_sweep_policies").select("threshold_minor,retain_minor,planning_reserve_bps,enabled,verified_owner_destination_id,standing_mandate_id").eq("coffer_id",cofferResult.data.coffer_id).maybeSingle()
  if(error)throw new Error("MONEY_WORKSPACE_SWEEP_POLICY_READ_FAILED:"+error.message)
  if(data)sweepPolicy=Object.freeze({thresholdMinor:String(data.threshold_minor),retainMinor:String(data.retain_minor),planningReserveBps:Number(data.planning_reserve_bps),enabled:Boolean(data.enabled),verifiedOwnerDestinationId:data.verified_owner_destination_id??null,standingMandateId:data.standing_mandate_id??null})
 }
 const c=cofferResult.data
 return Object.freeze({
  userId,
  coffer:c?Object.freeze({cofferId:c.coffer_id,currency:c.currency,principalCapitalMinor:String(c.principal_capital_minor),hardStopFloorMinor:String(c.hard_stop_floor_minor),survivalFloorMinor:String(c.survival_floor_minor),defensiveFloorMinor:String(c.defensive_floor_minor),state:c.state}):null,
  sweepPolicy,
  wallets:Object.freeze((walletResult.data??[]).map(x=>Object.freeze({connectionId:x.connection_id,provider:x.provider,network:x.network,address:x.address,mode:x.mode,status:x.status}))),
  connectors:Object.freeze((connectorResult.data??[]).map(x=>Object.freeze({connectorId:x.connector_id,provider:x.provider,lane:x.lane,admission:x.admission}))),
 })
}
