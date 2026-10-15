import type { MemeTradeAssessment } from '@jhadina/shark-intelligence-core/meme-trader'
import type { MemeWalletCandidate } from '@jhadina/money-core'

/**
 * Typed adapter from the REAL SHARK assessment contract. SHARK's default
 * liquidity/holder model scores are not evidence of sellability, and a
 * candidate/watching disposition is not approval to trade.
 *
 * Only receipt-bearing, source-timestamped safety checks may contribute a
 * positive paper-study flag. The checks still represent research provenance,
 * NOT external certification or live trading authority.
 */
export type MemePaperSafetyCheck='LIQUIDITY'|'SELLABILITY'|'TOKEN_PERMISSIONS'|'HOLDER_INDEPENDENCE'
export type MemePaperSafetyReceipt=Readonly<{
  check:MemePaperSafetyCheck
  tokenMint:string
  verified:boolean
  sourceId:string
  sourceGroup:string
  evidenceId:string
  observedAt:string
  availableAt:string
  authority:'CHAIN_RESEARCH_EVIDENCE_ONLY'
  canAuthorizeTrade:false
}>
export type MemePaperQuoteEvidence=Readonly<{
  quoteMint:string
  receivedAt:string
  expectedSlippageBps:number
  totalCostsMinor:bigint
  sourceId:string
  evidenceId:string
  authority:'QUOTE_RESEARCH_ONLY'
  canExecute:false
}>
const valid=(value:string)=>Number.isFinite(Date.parse(value))
export function mapSharkAssessmentToMemePaper(input:Readonly<{
  assessment:MemeTradeAssessment
  strategyId:string
  quote:MemePaperQuoteEvidence
  safety:readonly MemePaperSafetyReceipt[]
  cutoff:string
  maxEvidenceAgeMs:number
}>):MemeWalletCandidate{
  const a=input.assessment
  if(!['solana','SOLANA','solana-mainnet','solana-mainnet-beta'].includes(a.token.chainId)||
    !a.assessmentId.trim()||!input.strategyId.trim()||!a.token.tokenAddress.trim()||
    !valid(a.assessedAt)||!valid(input.cutoff)||!valid(input.quote.receivedAt)||
    !Number.isInteger(input.maxEvidenceAgeMs)||input.maxEvidenceAgeMs<1||
    input.maxEvidenceAgeMs>120_000)throw Error('MEME_SHARK_BRIDGE_INPUT_INVALID')
  const cutoff=Date.parse(input.cutoff)
  const quoteTime=Date.parse(input.quote.receivedAt)
  if(input.quote.authority!=='QUOTE_RESEARCH_ONLY'||input.quote.canExecute!==false||
    !input.quote.sourceId.trim()||!input.quote.evidenceId.trim()||
    quoteTime>cutoff||cutoff-quoteTime>input.maxEvidenceAgeMs) {
    throw Error('MEME_SHARK_BRIDGE_QUOTE_UNAVAILABLE')
  }
  if(a.assessedAt>input.cutoff)throw Error('MEME_SHARK_BRIDGE_FUTURE_ASSESSMENT')
  const safe=(check:MemePaperSafetyCheck)=>{
    const matching=input.safety.filter(x=>x.check===check)
    if(matching.length!==1)return false
    const s=matching[0]!
    if(!valid(s.observedAt)||!valid(s.availableAt))return false
    const available=Date.parse(s.availableAt)
    return s.verified===true && s.authority==='CHAIN_RESEARCH_EVIDENCE_ONLY' &&
      s.canAuthorizeTrade===false && s.tokenMint===a.token.tokenAddress &&
      s.sourceId.trim().length>0 && s.sourceGroup.trim().length>0 &&
      s.evidenceId.trim().length>0 &&
      Date.parse(s.observedAt)<=available && available<=cutoff &&
      cutoff-available<=input.maxEvidenceAgeMs
  }
  const rugBlocked=a.rugProtection.disposition!=='ALLOW_CANDIDATE' ||
    a.riskAssessment.band==='blocked'||a.riskAssessment.band==='high-risk' ||
    a.rugSelfProtection?.action==='QUARANTINE' ||
    a.rugSelfProtection?.action==='BLOCK_NEW_ENTRY' ||
    a.rugSelfProtection?.action==='EXIT_RECOMMENDED' ||
    (a.rugSelfProtection?.missingCriticalCoverage.length??1)>0
  const evidenceIds=[...new Set([
    ...a.evidenceIds,
    ...a.rugProtection.evidenceIds,
    ...(a.rugSelfProtection?.evidenceIds??[]),
    input.quote.evidenceId,
    ...input.safety.map(s=>s.evidenceId),
  ])]
  return Object.freeze({
    caseId:'shark:meme-assessment:'+a.assessmentId,
    strategyId:input.strategyId,
    tokenMint:a.token.tokenAddress,
    quoteMint:input.quote.quoteMint,
    observedAt:a.assessedAt,
    evidenceIds:Object.freeze(evidenceIds),
    liquidityVerified:safe('LIQUIDITY'),
    sellabilityVerified:safe('SELLABILITY'),
    tokenPermissionsSafe:safe('TOKEN_PERMISSIONS'),
    holderConcentrationSafe:safe('HOLDER_INDEPENDENCE'),
    rugVeto:rugBlocked,
    expectedSlippageBps:input.quote.expectedSlippageBps,
    estimatedTotalCostsMinor:input.quote.totalCostsMinor,
    quoteReceivedAt:input.quote.receivedAt,
    authority:'SHARK_RESEARCH_ONLY',
    canAuthorizeTrade:false,
  })
}
