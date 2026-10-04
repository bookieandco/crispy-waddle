import "server-only"

import {createHash} from 'node:crypto'
import {
  affiliatePayoutBalancesEqual,
  affiliatePayoutHighWaterFromReconciliation,
  reconcileAffiliatePayoutBalances,
  type AffiliatePayoutBalanceAdapter,
  type AffiliatePayoutReconciliation,
} from '@jhadina/commerce-adapters'
import {isSideHustleProfile} from '@jhadina/opportunity-core'
import type {StoredCanonicalOpportunity} from './canonical'
import type {
  AffiliatePayoutSnapshotRepository,
  StoredAffiliatePayoutSnapshot,
} from './affiliate-payout-repository'

export type AffiliatePayoutOpportunityRepository={
  get(id:string):Promise<StoredCanonicalOpportunity|undefined>
}

export type AffiliatePayoutSyncResult={
  opportunityId:string
  provider:string
  accountRef:string
  snapshotId:string
  snapshotRecorded:boolean
  reconciliation:AffiliatePayoutReconciliation
  recognizedPayoutSinceBaseline:Record<string,number>
  programAttributionAvailable:false
  externalActionAuthorized:false
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export async function syncAffiliatePayoutBalancesRuntime(
  input:{
    opportunityId:string
    accountRef:string
    observedAt?:string
  },
  adapter:AffiliatePayoutBalanceAdapter,
  opportunityRepository:AffiliatePayoutOpportunityRepository,
  payoutRepository:AffiliatePayoutSnapshotRepository,
):Promise<AffiliatePayoutSyncResult>{
  const opportunityId=requireText(input.opportunityId,'opportunityId')
  const accountRef=requireText(input.accountRef,'accountRef')
  const stored=await opportunityRepository.get(opportunityId)
  if(!stored)throw new Error('AFFILIATE_PAYOUT_OPPORTUNITY_NOT_FOUND')
  const profile=stored.opportunity.metadata?.sideHustleProfile
  if(!isSideHustleProfile(profile)||profile.family!=='commerce_affiliate'){
    throw new Error('AFFILIATE_PAYOUT_REQUIRES_COMMERCE_AFFILIATE')
  }

  const previous=await payoutRepository.latest({
    opportunityId,
    provider:adapter.name,
    accountRef,
  })
  const current=await adapter.readPayoutBalances({
    accountRef,
    observedAt:input.observedAt,
  })

  if(current.provider!==adapter.name){
    throw new Error('AFFILIATE_PAYOUT_PROVIDER_MISMATCH')
  }
  if(current.accountRef!==accountRef){
    throw new Error('AFFILIATE_PAYOUT_ACCOUNT_MISMATCH')
  }

  const reconciliation=reconcileAffiliatePayoutBalances(
    previous?.snapshot,
    current,
    previous?.paidHighWater,
  )
  const paidHighWater=affiliatePayoutHighWaterFromReconciliation(reconciliation)
  const recognizedPayoutSinceBaseline=accumulateRecognizedPayouts(
    previous?.recognizedPayoutSinceBaseline,
    reconciliation,
  )

  if(previous&&affiliatePayoutBalancesEqual(previous.snapshot,current)){
    return{
      opportunityId,
      provider:current.provider,
      accountRef,
      snapshotId:previous.id,
      snapshotRecorded:false,
      reconciliation,
      recognizedPayoutSinceBaseline,
      programAttributionAvailable:false,
      externalActionAuthorized:false,
      paymentAuthorized:false,
      moneyMovementAuthorized:false,
    }
  }

  const record:StoredAffiliatePayoutSnapshot={
    id:affiliatePayoutSnapshotId(opportunityId,current),
    opportunityId,
    provider:current.provider,
    accountRef:current.accountRef,
    snapshot:current,
    paidHighWater,
    recognizedPayoutSinceBaseline,
    observedAt:current.observedAt,
    authority:'AFFILIATE_PAYOUT_SNAPSHOT_ONLY',
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
  const saved=await payoutRepository.record(record)
  return{
    opportunityId,
    provider:current.provider,
    accountRef,
    snapshotId:saved.id,
    snapshotRecorded:true,
    reconciliation,
    recognizedPayoutSinceBaseline,
    programAttributionAvailable:false,
    externalActionAuthorized:false,
    paymentAuthorized:false,
    moneyMovementAuthorized:false,
  }
}

export function affiliatePayoutSnapshotId(
  opportunityId:string,
  snapshot:{
    provider:string
    accountRef:string
    balances:unknown
    observedAt:string
  },
):string{
  const fingerprint=JSON.stringify({
    opportunityId,
    provider:snapshot.provider,
    accountRef:snapshot.accountRef,
    balances:snapshot.balances,
    observedAt:snapshot.observedAt,
  })
  const digest=createHash('sha256').update(fingerprint).digest('hex').slice(0,28)
  return `affiliate-payout:${snapshot.provider}:${digest}`
}

function accumulateRecognizedPayouts(
  previous:Record<string,number>|undefined,
  reconciliation:AffiliatePayoutReconciliation,
):Record<string,number>{
  const output={...(previous??{})}
  for(const delta of reconciliation.currencies){
    output[delta.currency]=roundMoney(
      (output[delta.currency]??0)+delta.realizedPayoutDelta,
    )
  }
  return Object.fromEntries(
    Object.entries(output).sort(([a],[b])=>a.localeCompare(b)),
  )
}

function roundMoney(value:number):number{
  return Math.round((value+Number.EPSILON)*100)/100
}

function requireText(value:string,field:string):string{
  if(typeof value!=='string'||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}
