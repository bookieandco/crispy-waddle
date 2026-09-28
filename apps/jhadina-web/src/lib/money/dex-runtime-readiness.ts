import "server-only"
import { evaluateDexRuntimeReadiness, type DexRuntimeReadinessReport } from "@jhadina/money-core"
import type { ConnectedWallet, MoneyMarketConnectorDescriptor, SignerLease, StrategyBudgetSnapshot } from "@jhadina/money-core"
import { createClient } from "../supabase/server"
import { createServiceRoleClient } from "../supabase/service-role"

async function verifiedUserId(){
 const client=await createClient()
 const {data,error}=await client.auth.getClaims()
 const id=data?.claims?.sub
 if(error||!id)throw new Error("DEX_READINESS_SESSION_REQUIRED")
 return id
}

function admin(){
 const client=createServiceRoleClient()
 if(!client)throw new Error("DEX_READINESS_PRIVATE_STORE_NOT_CONFIGURED")
 return client
}

function configuredSecret(name:string):boolean{
 return Boolean(process.env[name]?.trim())
}
function configuredHttps(name:string):boolean{
 const value=process.env[name]?.trim()
 return Boolean(value&&value.startsWith("https://"))
}
function configuredMint(name:string):boolean{
 const value=process.env[name]?.trim()
 return Boolean(value&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value))
}

export async function readDexRuntimeReadiness():Promise<DexRuntimeReadinessReport>{
 const userId=await verifiedUserId()
 const db=admin()
 const now=new Date().toISOString()
 const settlementMint=process.env.MONEY_DEX_SETTLEMENT_MINT?.trim()??""

 const [cofferResult,walletResult,connectorResult]=await Promise.all([
  db.from("money_coffers").select("coffer_id").eq("user_id",userId).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
  db.from("money_wallet_connections").select("connection_id,user_id,provider,network,address,mode,status,evidence_ids,connected_at").eq("user_id",userId).eq("mode","COFFER_EXECUTION_WALLET").eq("status","ACTIVE").order("updated_at",{ascending:false}).limit(1).maybeSingle(),
  db.from("money_market_connector_admissions").select("connector_id,provider,lane,admission,credential_ref,evidence_ids").eq("lane","DEX").eq("provider","jupiter-ultra").order("updated_at",{ascending:false}).limit(1).maybeSingle(),
 ])
 if(cofferResult.error)throw new Error("DEX_READINESS_COFFER_READ_FAILED:"+cofferResult.error.message)
 if(walletResult.error)throw new Error("DEX_READINESS_WALLET_READ_FAILED:"+walletResult.error.message)
 if(connectorResult.error)throw new Error("DEX_READINESS_CONNECTOR_READ_FAILED:"+connectorResult.error.message)

 let cofferWallet:ConnectedWallet|undefined
 if(walletResult.data){
  const row=walletResult.data
  cofferWallet=Object.freeze({
   connectionId:row.connection_id,
   userId:row.user_id,
   provider:row.provider,
   network:row.network,
   address:row.address,
   mode:row.mode,
   connectedAt:row.connected_at,
   evidenceIds:Object.freeze(row.evidence_ids??[]),
   authority:"CONNECTION_ONLY" as const,
   canSign:false as const,
  })
 }

 let signerLease:SignerLease|undefined
 if(cofferWallet){
  const {data,error}=await db.from("money_signer_leases")
   .select("lease_id,wallet_connection_id,agent_id,session_id,token_fingerprint,issued_at,expires_at,state")
   .eq("wallet_connection_id",cofferWallet.connectionId)
   .order("updated_at",{ascending:false})
   .limit(1)
   .maybeSingle()
  if(error)throw new Error("DEX_READINESS_SIGNER_LEASE_READ_FAILED:"+error.message)
  if(data)signerLease=Object.freeze({
   leaseId:data.lease_id,walletConnectionId:data.wallet_connection_id,agentId:data.agent_id,sessionId:data.session_id,
   tokenFingerprint:data.token_fingerprint,issuedAt:data.issued_at,expiresAt:data.expires_at,state:data.state,
   authority:"LEASE_METADATA_ONLY" as const,containsPrivateKey:false as const,containsRawToken:false as const,
  })
 }

 let memeBudget:StrategyBudgetSnapshot|undefined
 if(cofferResult.data?.coffer_id){
  const {data,error}=await db.from("money_strategy_budgets")
   .select("budget_id,coffer_id,strategy_id,lane,currency,allocated_minor,reserved_minor,spent_minor,hard_cap_minor,state,updated_at,evidence_ids")
   .eq("coffer_id",cofferResult.data.coffer_id)
   .eq("lane","MEME")
   .order("updated_at",{ascending:false})
   .limit(1)
   .maybeSingle()
  if(error)throw new Error("DEX_READINESS_BUDGET_READ_FAILED:"+error.message)
  if(data)memeBudget=Object.freeze({
   budgetId:data.budget_id,cofferId:data.coffer_id,strategyId:data.strategy_id,lane:data.lane,currency:data.currency,
   allocatedMinor:BigInt(String(data.allocated_minor)),reservedMinor:BigInt(String(data.reserved_minor)),spentMinor:BigInt(String(data.spent_minor)),
   hardCapMinor:BigInt(String(data.hard_cap_minor)),state:data.state,observedAt:data.updated_at,evidenceIds:Object.freeze(data.evidence_ids??[]),authority:"BUDGET_EVIDENCE" as const,
  })
 }

 let connector:MoneyMarketConnectorDescriptor|undefined
 if(connectorResult.data){
  const row=connectorResult.data
  connector=Object.freeze({
   connectorId:row.connector_id,provider:row.provider,lane:row.lane,admission:row.admission,
   readCapabilities:Object.freeze(["quote","status"]),
   executionCapabilities:Object.freeze(["swap"]),
   credentialRef:row.credential_ref??undefined,
   evidenceIds:Object.freeze(row.evidence_ids??[]),
   authority:"CONNECTOR_METADATA_ONLY" as const,
  })
 }

 let canaryFundingEvidenceIds:readonly string[]=Object.freeze([])
 if(cofferWallet&&settlementMint){
  const {data,error}=await db.from("money_dex_canary_funding_evidence")
   .select("funding_evidence_id,evidence_ids")
   .eq("user_id",userId)
   .eq("wallet_connection_id",cofferWallet.connectionId)
   .eq("asset_id",settlementMint)
   .eq("verified",true)
   .order("observed_at",{ascending:false})
   .limit(1)
   .maybeSingle()
  if(error)throw new Error("DEX_READINESS_FUNDING_EVIDENCE_READ_FAILED:"+error.message)
  if(data)canaryFundingEvidenceIds=Object.freeze([data.funding_evidence_id,...(data.evidence_ids??[])])
 }

 return evaluateDexRuntimeReadiness({
  now,cofferWallet,signerLease,memeBudget,connector,
  jupiterCredentialConfigured:configuredSecret("JUPITER_API_KEY"),
  signerEndpointConfigured:configuredHttps("MONEY_DEX_COFFER_SIGNER_URL"),
  signerAuthorizationConfigured:configuredSecret("MONEY_DEX_COFFER_SIGNER_AUTH"),
  solanaRpcConfigured:configuredHttps("SOLANA_RPC_URL"),
  settlementMintConfigured:configuredMint("MONEY_DEX_SETTLEMENT_MINT"),
  canaryFundingEvidenceIds,
 })
}
