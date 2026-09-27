import { randomUUID } from "node:crypto"
import {
  createAlpacaPaperBrokerAdapter,
  createBrokerAccountEntitlement,
  createPaperAutopilotSettings,
  createStockWatchlistEntry,
  type PaperAutopilotMode,
} from "@jhadina/money-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import { createServiceRoleClient } from "../supabase/service-role"
import { resolveAlpacaPaperCredentials } from "./alpaca-paper-credentials"
import { SupabaseMoneyPaperRuntimeRepository } from "./paper-runtime-repository"

export type MoneyPaperSetupInput = Readonly<{
  accountId:string
  mode?:PaperAutopilotMode
  symbols?:readonly string[]
  stockFeed?:"iex"|"sip"|"delayed_sip"
  baseOrderNotionalMinor?:string
  maxOrderNotionalMinor?:string
  maximumConcurrentPositions?:number
  riskFractionBps?:number
  stopLossBps?:number
  takeProfitBps?:number
}>

export async function runSessionGovernedMoneyPaperSetup(
  input:MoneyPaperSetupInput,
  now=new Date().toISOString(),
){
  const identityVerifier=await createRequestIdentityVerifier()
  const identity=await identityVerifier.verify({})
  const client=createServiceRoleClient()
  if(!client)throw new Error("MONEY_PAPER_SETUP_STORAGE_UNAVAILABLE")

  const credentials=await resolveAlpacaPaperCredentials()
  const broker=createAlpacaPaperBrokerAdapter({credentials:()=>credentials})
  const account=await broker.getAccount(input.accountId,now)

  const {data:activeRows,error:activeReadError}=await client
    .from("money_broker_account_entitlements")
    .select("entitlement_id,capabilities,evidence_ids")
    .eq("user_id",identity.userId)
    .eq("provider","alpaca")
    .eq("account_id",account.accountId)
    .eq("status","ACTIVE")
    .limit(1)
  if(activeReadError)throw new Error("MONEY_PAPER_SETUP_ENTITLEMENT_READ_FAILED:"+activeReadError.message)

  const active=(activeRows??[])[0] as {entitlement_id:string;capabilities:string[];evidence_ids:string[]}|undefined
  const inheritedCapabilities=active?.capabilities??[]
  const evidenceIds=Object.freeze([
    "alpaca-paper-account:"+account.accountId,
    ...account.evidenceIds,
    ...(active?["supersedes-entitlement:"+active.entitlement_id,...(active.evidence_ids??[])]:[]),
  ])
  const entitlement=createBrokerAccountEntitlement({
    entitlementId:"paper-entitlement:"+randomUUID(),
    userId:identity.userId,
    provider:"alpaca",
    accountId:account.accountId,
    capabilities:[...new Set([...inheritedCapabilities,"money.market.observe","money.paper.trade.submit"])] as ("money.market.observe"|"money.paper.trade.submit"|"money.trade.submit")[],
    createdAt:now,
    evidenceIds,
  })

  if(active){
    const {error:revokeError}=await client
      .from("money_broker_account_entitlements")
      .update({status:"REVOKED",revoked_at:now,updated_at:now})
      .eq("entitlement_id",active.entitlement_id)
      .eq("status","ACTIVE")
    if(revokeError)throw new Error("MONEY_PAPER_SETUP_ENTITLEMENT_REVOKE_FAILED:"+revokeError.message)
  }

  const {error:entitlementError}=await client
    .from("money_broker_account_entitlements")
    .insert({
      entitlement_id:entitlement.entitlementId,
      user_id:entitlement.userId,
      provider:entitlement.provider,
      account_id:entitlement.accountId,
      capabilities:[...entitlement.capabilities],
      status:entitlement.status,
      created_at:entitlement.createdAt,
      expires_at:entitlement.expiresAt??null,
      revoked_at:null,
      evidence_ids:[...entitlement.evidenceIds],
      provenance_hash:entitlement.provenanceHash,
      updated_at:now,
    })
  if(entitlementError)throw new Error("MONEY_PAPER_SETUP_ENTITLEMENT_WRITE_FAILED:"+entitlementError.message)

  const settings=createPaperAutopilotSettings({
    userId:identity.userId,
    accountId:account.accountId,
    mode:input.mode??"ADVISE",
    stockFeed:input.stockFeed??"iex",
    strategyId:"stock-baseline-sma-20-50",
    baseOrderNotionalMinor:input.baseOrderNotionalMinor??"100000",
    maxOrderNotionalMinor:input.maxOrderNotionalMinor??"500000",
    maximumConcurrentPositions:input.maximumConcurrentPositions??5,
    riskFractionBps:input.riskFractionBps??50,
    stopLossBps:input.stopLossBps??200,
    takeProfitBps:input.takeProfitBps??400,
    updatedAt:now,
    evidenceIds:[entitlement.entitlementId],
  })
  const repo=new SupabaseMoneyPaperRuntimeRepository(client)
  await repo.putSettings(settings)

  const symbols=input.symbols?.length?input.symbols:["SPY","QQQ","AAPL","MSFT","NVDA"]
  for(const symbol of symbols){
    const entry=createStockWatchlistEntry({
      userId:identity.userId,
      symbol,
      addedAt:now,
      evidenceIds:[entitlement.entitlementId,"paper-setup:watchlist"],
    })
    await repo.putWatchlistEntry(entry)
  }

  return Object.freeze({
    userId:identity.userId,
    accountId:account.accountId,
    mode:settings.mode,
    stockFeed:settings.stockFeed,
    strategyId:settings.strategyId,
    symbols:Object.freeze([...symbols]),
    baseOrderNotionalMinor:settings.baseOrderNotionalMinor,
    maxOrderNotionalMinor:settings.maxOrderNotionalMinor,
    riskFractionBps:settings.riskFractionBps,
    stopLossBps:settings.stopLossBps,
    takeProfitBps:settings.takeProfitBps,
    canAuthorizeLive:false,
  })
}
