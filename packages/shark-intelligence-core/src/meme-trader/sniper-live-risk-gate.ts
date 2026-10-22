import {evaluateRugProtection,type RugProtectionInput,type RugAttackFingerprint} from './rug-protection'
import {evaluateRugSelfProtection,type RugCriticalCoverage} from './rug-self-protection'

/** LIVE-WIRING.02: read-only point-in-time safety gate. No model or wallet authority. */
export type SniperVerifiedEvidence=Readonly<{
  chainId:'solana-mainnet'
  tokenAddress:string
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
  proof:'CHAIN_ATTESTED'|'UNVERIFIED'
  confirmedSellRoute:boolean
  exitLiquidityLamports:bigint
  creatorClusterChecked:boolean
  independentHolderCoverage:boolean
  lpControlChecked:boolean
  tokenAuthorityChecked:boolean
}>
export type SniperLiveRiskDecision=Readonly<{
  tokenAddress:string
  disposition:'BLOCK'|'REVIEW'|'PAPER_CANDIDATE'
  mechanisms:readonly RugAttackFingerprint[]
  reasonCodes:readonly string[]
  evidenceIds:readonly string[]
  assessedAt:string
  authority:'RISK_RESEARCH_ONLY'
  canExecute:false
}>
export function assessSniperLiveRisk(input:{
  evidence:SniperVerifiedEvidence
  rug:RugProtectionInput
  now:string
  maxEvidenceAgeMs:number
  creatorBadLaunchRate?:number
}):SniperLiveRiskDecision{
 const e=input.evidence
 const nowMs=Date.parse(input.now),available=Date.parse(e.availableAt),observed=Date.parse(e.observedAt)
 if(!e.tokenAddress.trim()||e.chainId!=='solana-mainnet'||!e.evidenceIds.length||
   !Number.isFinite(nowMs)||!Number.isFinite(available)||!Number.isFinite(observed)||
   observed>available||!Number.isSafeInteger(input.maxEvidenceAgeMs)||input.maxEvidenceAgeMs<1||
   e.exitLiquidityLamports<0n)throw new Error('SNIPER_RISK_PROVENANCE_INVALID')
 if(input.creatorBadLaunchRate!==undefined&&(!Number.isFinite(input.creatorBadLaunchRate)||input.creatorBadLaunchRate<0||input.creatorBadLaunchRate>1)){
  throw new Error('SNIPER_RISK_CREATOR_RATE_INVALID')
 }
 const coverage:RugCriticalCoverage={
  sellability:e.confirmedSellRoute&&e.exitLiquidityLamports>0n,
  liquidityControl:e.lpControlChecked,
  authorityControl:e.tokenAuthorityChecked,
  holderIndependence:e.independentHolderCoverage,
  operatorIdentity:e.creatorClusterChecked,
 }
 const rug=evaluateRugProtection(input.rug)
 const safety=evaluateRugSelfProtection({
  rugProtection:rug,coverage,informationCutoff:input.now,
 })
 const codes:string[]=[]
 if(e.proof!=='CHAIN_ATTESTED')codes.push('ONCHAIN_ATTESTATION_REQUIRED')
 if(available>nowMs||nowMs-available>input.maxEvidenceAgeMs)codes.push('EVIDENCE_FUTURE_OR_STALE')
 if(!e.confirmedSellRoute||e.exitLiquidityLamports<=0n)codes.push('SELL_ROUTE_NOT_PROVEN')
 if(input.creatorBadLaunchRate!==undefined&&input.creatorBadLaunchRate>=.7)codes.push('CREATOR_REPEATED_BAD_LAUNCHES')
 if(rug.disposition==='BLOCK')codes.push('DETERMINISTIC_RUG_BLOCK')
 if(safety.action==='QUARANTINE'||safety.action==='BLOCK_NEW_ENTRY')codes.push('RUG_COVERAGE_OR_MODEL_VETO')
 if(safety.missingCriticalCoverage.length)codes.push(...safety.missingCriticalCoverage.map(x=>'MISSING_'+x.toUpperCase()))
 const blocking=codes.length>0
 return Object.freeze({
  tokenAddress:e.tokenAddress,
  disposition:blocking?'BLOCK':rug.disposition==='REVIEW'?'REVIEW':'PAPER_CANDIDATE',
  mechanisms:Object.freeze([...(rug.attackFingerprints??[])]),
  reasonCodes:Object.freeze([...new Set([...codes,...rug.hardBlockers])]),
  evidenceIds:Object.freeze([...new Set([...e.evidenceIds,...rug.evidenceIds,...safety.evidenceIds])].sort()),
  assessedAt:input.now,authority:'RISK_RESEARCH_ONLY',canExecute:false,
 })
}
