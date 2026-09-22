import { normalizeChainAddress } from './chain-identity'
import type { HeliusLaunchWebhookEvent } from './solana-launch-collector'
import type { LaunchOutcome } from './wallet-launch-pipeline'
import type { WalletClusterCalibrationObservation, WalletClusterOutcome } from './wallet-cluster-calibration'

export type WalletResearchScoreEvidence=Readonly<{
  scoreId:string
  chainId:string
  walletId:string
  scoreModelId:string
  score:number
  informationCutoff:string
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
  authority:'RESEARCH_ONLY'
}>

export type WalletBuyEvidence=Readonly<{
  evidenceId:string
  signature:string
  chainId:string
  tokenAddress:string
  walletId:string
  observedAt:string
  availableAt:string
  amountUsd?:number
  evidenceIds:readonly string[]
  source:string
}>

export type WalletClusterOutcomeEvidence=Readonly<{
  tokenId:string
  outcome:LaunchOutcome
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
}>

export type WalletQuoteAsset=Readonly<{
  mint:string
  usdValuePerUnit?:number
}>

const assertIso=(value:string,code:string)=>{if(!value||Number.isNaN(Date.parse(value)))throw new Error(code)}
const latest=(values:string[])=>values.reduce((a,b)=>Date.parse(a)>=Date.parse(b)?a:b)
const stableFingerprint=(value:string):string=>{
  let a=0x811c9dc5,b=0x9e3779b9
  for(let i=0;i<value.length;i+=1){
    const code=value.charCodeAt(i)
    a^=code;a=Math.imul(a,0x01000193)>>>0
    b^=code+i;b=Math.imul(b,0x85ebca6b)>>>0
  }
  return `${a.toString(16).padStart(8,'0')}${b.toString(16).padStart(8,'0')}`
}

export function assertWalletResearchScoreEvidence(score:WalletResearchScoreEvidence):void{
  if(!score.scoreId.trim()||!score.chainId.trim()||!score.walletId.trim()||!score.scoreModelId.trim()||!score.evidenceIds.length)throw new Error('shark_wallet_score_evidence_incomplete')
  if(!Number.isFinite(score.score)||score.score<0)throw new Error('shark_wallet_score_invalid')
  assertIso(score.informationCutoff,'shark_wallet_score_cutoff_invalid')
  assertIso(score.observedAt,'shark_wallet_score_observed_at_invalid')
  assertIso(score.availableAt,'shark_wallet_score_available_at_invalid')
  if(Date.parse(score.informationCutoff)>Date.parse(score.observedAt))throw new Error('shark_wallet_score_future_information')
  if(Date.parse(score.availableAt)<Date.parse(score.observedAt))throw new Error('shark_wallet_score_availability_invalid')
  if(score.authority!=='RESEARCH_ONLY')throw new Error('shark_wallet_score_authority_invalid')
}

export function assertWalletBuyEvidence(buy:WalletBuyEvidence):void{
  if(!buy.evidenceId.trim()||!buy.signature.trim()||!buy.chainId.trim()||!buy.tokenAddress.trim()||!buy.walletId.trim()||!buy.source.trim()||!buy.evidenceIds.length)throw new Error('shark_wallet_buy_evidence_incomplete')
  assertIso(buy.observedAt,'shark_wallet_buy_observed_at_invalid')
  assertIso(buy.availableAt,'shark_wallet_buy_available_at_invalid')
  if(Date.parse(buy.availableAt)<Date.parse(buy.observedAt))throw new Error('shark_wallet_buy_availability_invalid')
  if(buy.amountUsd!==undefined&&(!Number.isFinite(buy.amountUsd)||buy.amountUsd<0))throw new Error('shark_wallet_buy_usd_invalid')
}

export function collectTrackedWalletBuysFromHelius(input:{
  event:HeliusLaunchWebhookEvent
  chainId:string
  trackedWalletIds:readonly string[]
  quoteAssets:readonly WalletQuoteAsset[]
  availableAt:string
  source?:string
}):WalletBuyEvidence[]{
  assertIso(input.availableAt,'shark_wallet_buy_available_at_invalid')
  const signature=input.event.signature
  const seconds=input.event.timestamp
  if(!signature||!Number.isFinite(seconds)||!seconds||seconds<=0)return []
  const observedAt=new Date(seconds*1000).toISOString()
  if(Date.parse(input.availableAt)<Date.parse(observedAt))throw new Error('shark_wallet_buy_availability_invalid')
  const chainId=input.chainId.trim()
  if(!chainId)throw new Error('shark_wallet_buy_chain_required')
  const tracked=new Set(input.trackedWalletIds.map(wallet=>normalizeChainAddress(chainId,wallet)))
  const quotes=new Map<string,WalletQuoteAsset>()
  for(const quote of input.quoteAssets){
    const mint=normalizeChainAddress(chainId,quote.mint)
    if(quote.usdValuePerUnit!==undefined&&(!Number.isFinite(quote.usdValuePerUnit)||quote.usdValuePerUnit<=0))throw new Error('shark_wallet_buy_quote_value_invalid')
    quotes.set(mint,{...quote,mint})
  }
  const transfers=(input.event.tokenTransfers??[]).flatMap(t=>{
    if(!t.mint||typeof t.tokenAmount!=='number'||!Number.isFinite(t.tokenAmount)||t.tokenAmount<=0)return []
    return [{...t,mint:normalizeChainAddress(chainId,t.mint)}]
  })
  const rows:WalletBuyEvidence[]=[]
  for(const walletId of tracked){
    const quoteSpends=transfers.filter(t=>t.fromUserAccount&&normalizeChainAddress(chainId,t.fromUserAccount)===walletId&&quotes.has(t.mint))
    if(!quoteSpends.length)continue
    const received=transfers.filter(t=>t.toUserAccount&&normalizeChainAddress(chainId,t.toUserAccount)===walletId&&!quotes.has(t.mint))
    const receivedMints=[...new Set(received.map(t=>t.mint))]
    // Multi-token receipts cannot be safely allocated a shared quote spend.
    if(receivedMints.length!==1)continue
    const tokenAddress=receivedMints[0]!
    const valuationComplete=quoteSpends.every(t=>quotes.get(t.mint)?.usdValuePerUnit!==undefined)
    const amountUsd=valuationComplete
      ? quoteSpends.reduce((sum,t)=>sum+t.tokenAmount!*(quotes.get(t.mint)!.usdValuePerUnit!),0)
      : undefined
    const evidenceId=`helius:wallet-buy:${signature}:${walletId}:${tokenAddress}`
    rows.push(Object.freeze({
      evidenceId,
      signature,
      chainId,
      tokenAddress,
      walletId,
      observedAt,
      availableAt:input.availableAt,
      ...(amountUsd===undefined?{}:{amountUsd}),
      evidenceIds:Object.freeze([evidenceId,`solana-signature:${signature}`]),
      source:input.source??'helius-enhanced-transaction',
    }))
  }
  return rows.sort((a,b)=>a.walletId.localeCompare(b.walletId)||a.tokenAddress.localeCompare(b.tokenAddress))
}

function mapOutcome(outcome:LaunchOutcome):WalletClusterOutcome{
  if(outcome==='HEALTHY')return 'HEALTHY'
  if(outcome==='RUG'||outcome==='FAILED'||outcome==='PUMP_AND_DUMP')return 'ADVERSE'
  return 'UNKNOWN'
}

function scoreForWallet(input:{
  chainId:string
  walletId:string
  scoreModelId:string
  signalObservedAt:string
  signalAvailableAt:string
  scores:readonly WalletResearchScoreEvidence[]
}):WalletResearchScoreEvidence|undefined{
  const candidates=input.scores.filter(score=>
    score.chainId===input.chainId
    && normalizeChainAddress(input.chainId,score.walletId)===input.walletId
    && score.scoreModelId===input.scoreModelId
    && Date.parse(score.informationCutoff)<=Date.parse(input.signalObservedAt)
    && Date.parse(score.availableAt)<=Date.parse(input.signalAvailableAt)
  )
  return [...candidates].sort((a,b)=>Date.parse(b.availableAt)-Date.parse(a.availableAt)||Date.parse(b.informationCutoff)-Date.parse(a.informationCutoff)||a.scoreId.localeCompare(b.scoreId))[0]
}

export function deriveWalletClusterCalibrationObservations(input:{
  chainId:string
  tokenAddress:string
  tokenId:string
  scoreModelId:string
  buys:readonly WalletBuyEvidence[]
  scores:readonly WalletResearchScoreEvidence[]
  outcome:WalletClusterOutcomeEvidence
  minimumWallets?:number
}):WalletClusterCalibrationObservation[]{
  const chainId=input.chainId.trim()
  const tokenAddress=normalizeChainAddress(chainId,input.tokenAddress)
  if(!input.tokenId.trim()||!input.scoreModelId.trim())throw new Error('shark_cluster_producer_identity_required')
  if(input.outcome.tokenId!==input.tokenId)throw new Error('shark_cluster_producer_outcome_identity_mismatch')
  if(input.outcome.outcome==='UNKNOWN')throw new Error('shark_cluster_producer_outcome_unlabeled')
  assertIso(input.outcome.observedAt,'shark_cluster_producer_outcome_observed_at_invalid')
  assertIso(input.outcome.availableAt,'shark_cluster_producer_outcome_available_at_invalid')
  if(Date.parse(input.outcome.availableAt)<Date.parse(input.outcome.observedAt))throw new Error('shark_cluster_producer_outcome_availability_invalid')
  if(!input.outcome.evidenceIds.length)throw new Error('shark_cluster_producer_outcome_evidence_required')
  const minimumWallets=input.minimumWallets??2
  if(!Number.isInteger(minimumWallets)||minimumWallets<2)throw new Error('shark_cluster_producer_minimum_wallets_invalid')

  input.scores.forEach(assertWalletResearchScoreEvidence)
  const buys=input.buys.map(buy=>{
    assertWalletBuyEvidence(buy)
    if(buy.chainId!==chainId||normalizeChainAddress(chainId,buy.tokenAddress)!==tokenAddress)throw new Error('shark_cluster_producer_buy_identity_mismatch')
    return {...buy,walletId:normalizeChainAddress(chainId,buy.walletId)}
  }).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)||a.walletId.localeCompare(b.walletId))

  const earliestByWallet=new Map<string,WalletBuyEvidence>()
  for(const buy of buys)if(!earliestByWallet.has(buy.walletId))earliestByWallet.set(buy.walletId,buy)
  const earliest=[...earliestByWallet.values()].sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)||a.walletId.localeCompare(b.walletId))
  const results:WalletClusterCalibrationObservation[]=[]

  for(let end=0;end<earliest.length;end+=1){
    const endpoint=earliest[end]!
    const signalObservedAt=endpoint.observedAt
    const signalAvailableAt=latest(earliest.slice(0,end+1).map(b=>b.availableAt))
    const selected=earliest.slice(0,end+1).flatMap(buy=>{
      const score=scoreForWallet({chainId,walletId:buy.walletId,scoreModelId:input.scoreModelId,signalObservedAt,signalAvailableAt,scores:input.scores})
      return score?[{buy,score}]:[]
    })
    if(selected.length<minimumWallets)continue
    const firstObserved=selected.map(x=>x.buy.observedAt).reduce((a,b)=>Date.parse(a)<=Date.parse(b)?a:b)
    const windowSeconds=Math.max(0,Math.round((Date.parse(signalObservedAt)-Date.parse(firstObserved))/1000))
    const allUsd=selected.every(x=>x.buy.amountUsd!==undefined)
    const totalUsd=allUsd?selected.reduce((sum,x)=>sum+x.buy.amountUsd!,0):undefined
    const wallets=selected.map(x=>x.buy.walletId).sort()
    const evidenceIds=[...new Set([
      ...selected.flatMap(x=>x.buy.evidenceIds),
      ...selected.flatMap(x=>x.score.evidenceIds),
      ...selected.map(x=>x.score.scoreId),
      ...input.outcome.evidenceIds,
    ])].sort()
    const fingerprint=stableFingerprint(JSON.stringify([input.tokenId,input.scoreModelId,signalObservedAt,wallets,evidenceIds]))
    results.push(Object.freeze({
      observationId:`wallet-cluster-calibration:${fingerprint}`,
      tokenId:input.tokenId,
      scoreModelId:input.scoreModelId,
      distinctWallets:selected.length,
      windowSeconds,
      aggregateWalletScore:selected.reduce((sum,x)=>sum+x.score.score,0),
      ...(totalUsd===undefined?{}:{totalUsd}),
      observedAt:signalObservedAt,
      availableAt:latest([signalAvailableAt,input.outcome.availableAt]),
      outcome:mapOutcome(input.outcome.outcome),
      evidenceIds:Object.freeze(evidenceIds),
    }))
  }
  return results
}
