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
  maxDeployableBps:number
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
 budgets:readonly Readonly<{
  budgetId:string
  strategyId:string
  lane:string
  currency:string
  allocatedMinor:string
  reservedMinor:string
  spentMinor:string
  hardCapMinor:string
  state:"ACTIVE"|"HALTED"|"EXHAUSTED"
 }>[] 
 wallets:readonly Readonly<{
  connectionId:string
  provider:string
  network:string
  address:string
  mode:"OWNER_WALLET"|"COFFER_EXECUTION_WALLET"
  status:"ACTIVE"|"DISCONNECTED"|"REVOKED"
 }>[] 
 signerLeases:readonly Readonly<{
  leaseId:string
  walletConnectionId:string
  agentId:string
  sessionId:string
  issuedAt:string
  expiresAt:string
  state:"ACTIVE"|"LOCKED"|"EXPIRED"|"REVOKED"
  perTransactionCapMinor:string
  rolling24hCapMinor:string
  maxTransactionCount:number
  allowedDestinationAddresses:readonly string[]
  allowedAssets:readonly string[]
 }>[] 
 syncStates:readonly Readonly<{
  syncId:string
  provider:string
  providerItemId:string
  state:"ACTIVE"|"LOGIN_REQUIRED"|"SYNC_ERROR"|"DISABLED"
  includedAccountIds:readonly string[]
  lastSuccessfulSyncAt:string|null
  lastErrorCode:string|null
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
 const [cofferResult,walletResult,connectorResult,syncResult]=await Promise.all([
  db.from("money_coffers").select("coffer_id,currency,principal_capital_minor,hard_stop_floor_minor,survival_floor_minor,defensive_floor_minor,max_deployable_bps,state").eq("user_id",userId).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
  db.from("money_wallet_connections").select("connection_id,provider,network,address,mode,status").eq("user_id",userId).order("updated_at",{ascending:false}),
  db.from("money_market_connector_admissions").select("connector_id,provider,lane,admission").order("updated_at",{ascending:false}),
  db.from("money_provider_sync_state").select("sync_id,provider,provider_item_id,state,included_account_ids,last_successful_sync_at,last_error_code").eq("user_id",userId).order("updated_at",{ascending:false}),
 ])
 if(cofferResult.error)throw new Error("MONEY_WORKSPACE_COFFER_READ_FAILED:"+cofferResult.error.message)
 if(walletResult.error)throw new Error("MONEY_WORKSPACE_WALLET_READ_FAILED:"+walletResult.error.message)
 if(connectorResult.error)throw new Error("MONEY_WORKSPACE_CONNECTOR_READ_FAILED:"+connectorResult.error.message)
 if(syncResult.error)throw new Error("MONEY_WORKSPACE_SYNC_READ_FAILED:"+syncResult.error.message)

 let sweepPolicy:MoneyWorkspaceSnapshot["sweepPolicy"]=null
 let budgets:MoneyWorkspaceSnapshot["budgets"]=Object.freeze([])
 if(cofferResult.data?.coffer_id){
  const [sweepResult,budgetResult]=await Promise.all([
   db.from("money_profit_sweep_policies").select("threshold_minor,retain_minor,planning_reserve_bps,enabled,verified_owner_destination_id,standing_mandate_id").eq("coffer_id",cofferResult.data.coffer_id).maybeSingle(),
   db.from("money_strategy_budgets").select("budget_id,strategy_id,lane,currency,allocated_minor,reserved_minor,spent_minor,hard_cap_minor,state").eq("coffer_id",cofferResult.data.coffer_id).order("lane",{ascending:true}),
  ])
  if(sweepResult.error)throw new Error("MONEY_WORKSPACE_SWEEP_POLICY_READ_FAILED:"+sweepResult.error.message)
  if(budgetResult.error)throw new Error("MONEY_WORKSPACE_BUDGET_READ_FAILED:"+budgetResult.error.message)
  if(sweepResult.data)sweepPolicy=Object.freeze({thresholdMinor:String(sweepResult.data.threshold_minor),retainMinor:String(sweepResult.data.retain_minor),planningReserveBps:Number(sweepResult.data.planning_reserve_bps),enabled:Boolean(sweepResult.data.enabled),verifiedOwnerDestinationId:sweepResult.data.verified_owner_destination_id??null,standingMandateId:sweepResult.data.standing_mandate_id??null})
  budgets=Object.freeze((budgetResult.data??[]).map(x=>Object.freeze({
   budgetId:x.budget_id,strategyId:x.strategy_id,lane:x.lane,currency:x.currency,
   allocatedMinor:String(x.allocated_minor),reservedMinor:String(x.reserved_minor),spentMinor:String(x.spent_minor),hardCapMinor:String(x.hard_cap_minor),
   state:x.state as MoneyWorkspaceSnapshot["budgets"][number]["state"],
  })))
 }

 const walletIds=(walletResult.data??[]).map(x=>x.connection_id)
 let signerLeases:MoneyWorkspaceSnapshot["signerLeases"]=Object.freeze([])
 if(walletIds.length){
  const {data,error}=await db.from("money_signer_leases").select("lease_id,wallet_connection_id,agent_id,session_id,issued_at,expires_at,state,per_transaction_cap_minor,rolling_24h_cap_minor,max_transaction_count,allowed_destination_addresses,allowed_assets").in("wallet_connection_id",walletIds).order("updated_at",{ascending:false})
  if(error)throw new Error("MONEY_WORKSPACE_SIGNER_LEASE_READ_FAILED:"+error.message)
  signerLeases=Object.freeze((data??[]).map(x=>Object.freeze({
   leaseId:x.lease_id,walletConnectionId:x.wallet_connection_id,agentId:x.agent_id,sessionId:x.session_id,issuedAt:x.issued_at,expiresAt:x.expires_at,
   state:x.state as MoneyWorkspaceSnapshot["signerLeases"][number]["state"],
   perTransactionCapMinor:String(x.per_transaction_cap_minor),rolling24hCapMinor:String(x.rolling_24h_cap_minor),maxTransactionCount:Number(x.max_transaction_count),
   allowedDestinationAddresses:Object.freeze(x.allowed_destination_addresses??[]),allowedAssets:Object.freeze(x.allowed_assets??[]),
  })))
 }

 const c=cofferResult.data
 return Object.freeze({
  userId,
  coffer:c?Object.freeze({
   cofferId:c.coffer_id,currency:c.currency,principalCapitalMinor:String(c.principal_capital_minor),hardStopFloorMinor:String(c.hard_stop_floor_minor),
   survivalFloorMinor:String(c.survival_floor_minor),defensiveFloorMinor:String(c.defensive_floor_minor),maxDeployableBps:Number(c.max_deployable_bps),
   state:c.state as NonNullable<MoneyWorkspaceSnapshot["coffer"]>["state"],
  }):null,
  sweepPolicy,
  budgets,
  wallets:Object.freeze((walletResult.data??[]).map(x=>Object.freeze({connectionId:x.connection_id,provider:x.provider,network:x.network,address:x.address,mode:x.mode as MoneyWorkspaceSnapshot["wallets"][number]["mode"],status:x.status as MoneyWorkspaceSnapshot["wallets"][number]["status"]}))),
  signerLeases,
  syncStates:Object.freeze((syncResult.data??[]).map(x=>Object.freeze({
   syncId:x.sync_id,provider:x.provider,providerItemId:x.provider_item_id,state:x.state as MoneyWorkspaceSnapshot["syncStates"][number]["state"],
   includedAccountIds:Object.freeze(x.included_account_ids??[]),lastSuccessfulSyncAt:x.last_successful_sync_at??null,lastErrorCode:x.last_error_code??null,
  }))),
  connectors:Object.freeze((connectorResult.data??[]).map(x=>Object.freeze({connectorId:x.connector_id,provider:x.provider,lane:x.lane as MoneyWorkspaceSnapshot["connectors"][number]["lane"],admission:x.admission as MoneyWorkspaceSnapshot["connectors"][number]["admission"]}))),
 })
}
