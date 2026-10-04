import "server-only"

import {createHash} from "node:crypto"
import type {
  AffiliateNetworkObservationAdapter,
  AffiliatePayoutBalanceAdapter,
} from "@jhadina/commerce-adapters"
import type {
  SideHustleAffiliatePortfolioTruth,
  SideHustleCommissioningEvidence,
} from "@jhadina/opportunity-core"
import {
  syncAffiliateNetworkObservations,
  type AffiliateNetworkSyncResult,
} from "./affiliate-network-sync"
import {
  syncAffiliatePayoutBalancesRuntime,
  type AffiliatePayoutOpportunityRepository,
  type AffiliatePayoutSyncResult,
} from "./affiliate-payout-runtime"
import type {
  AffiliatePayoutSnapshotRepository,
} from "./affiliate-payout-repository"
import {summarizeAffiliatePortfolioRuntime} from "./affiliate-portfolio-runtime"
import {
  listSideHustleLiveCommissioningRuntime,
  recordSideHustleCommissioningEvidenceRuntime,
} from "./side-hustle-commissioning-runtime"
import type {
  SideHustleCommissioningEvidenceRepository,
} from "./side-hustle-commissioning-repository"
import type {
  SideHustleCommercePersistence,
} from "./side-hustle-commerce-runtime"

export type AffiliateLiveCommissioningProvider = "partnerize" | "cj-affiliate"

export type AffiliateLiveCommissioningOpportunityRepository =
  SideHustleCommercePersistence & AffiliatePayoutOpportunityRepository

export type AffiliateLiveCommissioningResult = {
  opportunityId:string
  provider:AffiliateLiveCommissioningProvider
  observedAt:string
  network:AffiliateNetworkSyncResult
  programPayout?:AffiliateNetworkSyncResult
  payout?:AffiliatePayoutSyncResult
  portfolio:SideHustleAffiliatePortfolioTruth
  evidence:SideHustleCommissioningEvidence[]
  passedGates:string[]
  pendingGates:string[]
  status:"commissioning"|"blocked"|"certified"
  externalActionAuthorized:false
  publishingAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export async function commissionAffiliateLiveRuntime(
  input:{
    opportunityId:string
    provider:AffiliateLiveCommissioningProvider
    accountRef:string
    startAt?:string
    endAt?:string
    maxPages?:number
    observedAt?:string
    credentialFreshnessDays?:number
  },
  dependencies:{
    networkAdapter:AffiliateNetworkObservationAdapter
    programPayoutAdapter?:AffiliateNetworkObservationAdapter
    payoutAdapter?:AffiliatePayoutBalanceAdapter
    opportunityRepository:AffiliateLiveCommissioningOpportunityRepository
    payoutRepository:AffiliatePayoutSnapshotRepository
    commissioningRepository:SideHustleCommissioningEvidenceRepository
  },
):Promise<AffiliateLiveCommissioningResult>{
  const opportunityId=requireText(input.opportunityId,"opportunityId")
  const accountRef=requireText(input.accountRef,"accountRef")
  const observedAt=normalizeDate(input.observedAt??new Date().toISOString(),"observedAt")
  const freshnessDays=input.credentialFreshnessDays??7
  if(!Number.isInteger(freshnessDays)||freshnessDays<1||freshnessDays>30){
    throw new Error("AFFILIATE_COMMISSIONING_FRESHNESS_DAYS_INVALID")
  }
  if(dependencies.networkAdapter.name!==input.provider){
    throw new Error("AFFILIATE_COMMISSIONING_NETWORK_PROVIDER_MISMATCH")
  }

  const network=await syncAffiliateNetworkObservations(
    {
      opportunityId,
      accountRef,
      startAt:input.startAt,
      endAt:input.endAt,
      maxPages:input.maxPages,
    },
    dependencies.networkAdapter,
    dependencies.opportunityRepository,
  )
  if(!network.complete){
    throw new Error("AFFILIATE_COMMISSIONING_NETWORK_INCOMPLETE")
  }

  let programPayout:AffiliateNetworkSyncResult|undefined
  if(dependencies.programPayoutAdapter){
    if(dependencies.programPayoutAdapter.name!==input.provider){
      throw new Error("AFFILIATE_COMMISSIONING_PROGRAM_PAYOUT_PROVIDER_MISMATCH")
    }
    programPayout=await syncAffiliateNetworkObservations(
      {
        opportunityId,
        accountRef,
        startAt:input.startAt,
        endAt:input.endAt,
        maxPages:input.maxPages,
      },
      dependencies.programPayoutAdapter,
      dependencies.opportunityRepository,
    )
    if(!programPayout.complete){
      throw new Error("AFFILIATE_COMMISSIONING_PROGRAM_PAYOUT_INCOMPLETE")
    }
  }

  const portfolio=await summarizeAffiliatePortfolioRuntime(
    {opportunityId},
    dependencies.opportunityRepository,
  )

  let payout:AffiliatePayoutSyncResult|undefined
  if(dependencies.payoutAdapter){
    if(dependencies.payoutAdapter.name!==input.provider){
      throw new Error("AFFILIATE_COMMISSIONING_PAYOUT_PROVIDER_MISMATCH")
    }
    payout=await syncAffiliatePayoutBalancesRuntime(
      {opportunityId,accountRef,observedAt},
      dependencies.payoutAdapter,
      dependencies.opportunityRepository,
      dependencies.payoutRepository,
    )
  }

  const evidence:SideHustleCommissioningEvidence[]=[]
  const connectivityRefs=unique([
    commissioningReadRef(input.provider,accountRef,observedAt),
    ...network.eventIds.slice(0,20),
  ])
  const expiresAt=addDays(observedAt,freshnessDays)

  evidence.push(await recordSideHustleCommissioningEvidenceRuntime({
    id:evidenceId(opportunityId,input.provider,"provider",observedAt),
    family:"commerce_affiliate",
    gateType:"provider",
    status:"passed",
    providerRef:input.provider,
    note:"Authenticated read-only affiliate network sync completed.",
    evidenceRefs:connectivityRefs,
    observedAt,
    expiresAt,
  },dependencies.commissioningRepository))

  evidence.push(await recordSideHustleCommissioningEvidenceRuntime({
    id:evidenceId(opportunityId,input.provider,"credential",observedAt),
    family:"commerce_affiliate",
    gateType:"credential",
    status:"passed",
    providerRef:input.provider,
    note:"Provider accepted the configured server-side credential during a read-only sync.",
    evidenceRefs:connectivityRefs,
    observedAt,
    expiresAt,
  },dependencies.commissioningRepository))

  const livePrograms=portfolio.programs.filter(program=>
    program.approvedConversionCount+program.paidStateConversionCount>0
  )
  if(livePrograms.length>0){
    evidence.push(await recordSideHustleCommissioningEvidenceRuntime({
      id:evidenceId(opportunityId,input.provider,"live_customer",observedAt),
      family:"commerce_affiliate",
      gateType:"live_customer",
      status:"passed",
      providerRef:input.provider,
      note:"Provider-native approved/paid affiliate conversion evidence exists.",
      evidenceRefs:unique(
        livePrograms.flatMap(program=>program.evidenceRefs).slice(0,20),
      ),
      observedAt,
    },dependencies.commissioningRepository))
  }

  const paidPrograms=portfolio.programs.filter(program=>
    program.currencies.some(currency=>currency.realizedRevenueAmount>0)
  )
  const accountPayoutDelta=Boolean(
    payout&&sumMoney(payout.recognizedPayoutSinceBaseline)>0
  )
  if(paidPrograms.length>0||accountPayoutDelta){
    const paymentEvidence=unique([
      ...(accountPayoutDelta&&payout?[payout.snapshotId]:[]),
      ...paidPrograms.flatMap(program=>program.evidenceRefs).slice(0,20),
    ])
    evidence.push(await recordSideHustleCommissioningEvidenceRuntime({
      id:evidenceId(opportunityId,input.provider,"payment_billing",observedAt),
      family:"commerce_affiliate",
      gateType:"payment_billing",
      status:"passed",
      providerRef:input.provider,
      note:paidPrograms.length>0
        ?"Provider-native paid self-bill item evidence exists for an affiliate program."
        :"A positive provider-paid account balance delta has been recognized since the monitoring baseline.",
      evidenceRefs:paymentEvidence,
      observedAt,
    },dependencies.commissioningRepository))
  }

  const live=await listSideHustleLiveCommissioningRuntime(
    {family:"commerce_affiliate",evaluatedAt:observedAt},
    dependencies.commissioningRepository,
  )
  const state=live.states[0]
  if(!state)throw new Error("AFFILIATE_COMMISSIONING_STATE_UNAVAILABLE")

  return{
    opportunityId,
    provider:input.provider,
    observedAt,
    network,
    programPayout,
    payout,
    portfolio,
    evidence,
    passedGates:state.gates
      .filter(gate=>gate.status==="passed"||gate.status==="not_applicable")
      .map(gate=>gate.gateType),
    pendingGates:state.gates
      .filter(gate=>gate.status==="pending"||gate.status==="blocked")
      .map(gate=>gate.gateType),
    status:state.status==="not_applicable"?"commissioning":state.status,
    externalActionAuthorized:false,
    publishingAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

function evidenceId(
  opportunityId:string,
  provider:string,
  gate:string,
  observedAt:string,
):string{
  const digest=createHash("sha256")
    .update([opportunityId,provider,gate,observedAt].join("|"))
    .digest("hex")
    .slice(0,24)
  return `affiliate-commissioning:${provider}:${gate}:${digest}`
}

function commissioningReadRef(
  provider:string,
  accountRef:string,
  observedAt:string,
):string{
  const digest=createHash("sha256")
    .update([provider,accountRef,observedAt].join("|"))
    .digest("hex")
    .slice(0,24)
  return `affiliate-provider-read:${provider}:${digest}`
}

function addDays(value:string,days:number):string{
  return new Date(Date.parse(value)+days*86_400_000).toISOString()
}

function sumMoney(value:Record<string,number>):number{
  return Object.values(value).reduce((sum,amount)=>sum+amount,0)
}

function normalizeDate(value:string,field:string):string{
  const parsed=Date.parse(value)
  if(!Number.isFinite(parsed))throw new Error(`${field} must be a valid date`)
  return new Date(parsed).toISOString()
}

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))]
}

function requireText(value:string,field:string):string{
  if(typeof value!=="string"||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}
