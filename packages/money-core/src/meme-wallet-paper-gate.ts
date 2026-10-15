import { createHash } from 'node:crypto'
import type { LiveCanaryPolicy } from './live-canary-contracts.js'

/**
 * MEME-WALLET.01–.08. The owner created a separate address, but an address
 * alone is NOT a control proof, signer lease, Coffer wallet, MCP session, or
 * owner permission to move funds. The exact address is an injected input,
 * never a committed application default.
 */
export type MemeWalletResearchIdentity=Readonly<{
  walletId:string
  solanaAddress:string
  chain:'SOLANA_MAINNET'
  role:'JHADINA_OWNER_CREATED'
  control:'UNVERIFIED'|'CHALLENGE_VERIFIED'
  mcpWallet:'NOT_LINKED'
  signer:'DISABLED'
  financialAuthority:'NONE'
  canSign:false
  canFund:false
  canExecute:false
}>
export type MemeWalletPaperPolicy=Readonly<{
  policyId:string
  ownerReview:'PENDING'|'APPROVED_FOR_PAPER_ONLY'
  paperOnly:true
  liveExecutionEnabled:false
  maxPaperEntryMinor:bigint
  maxPaperDailyNotionalMinor:bigint
  maxPaperGrossExposureMinor:bigint
  maxPaperDailyLossMinor:bigint
  maxPaperOrdersPerDay:number
  maxSlippageBps:number
  maxQuoteAgeMs:number
  allowedQuoteMints:readonly string[]
  authority:'PAPER_RISK_POLICY_ONLY'
}>
export type MemeWalletCandidate=Readonly<{
  caseId:string
  strategyId:string
  tokenMint:string
  quoteMint:string
  observedAt:string
  evidenceIds:readonly string[]
  liquidityVerified:boolean
  sellabilityVerified:boolean
  tokenPermissionsSafe:boolean
  holderConcentrationSafe:boolean
  rugVeto:boolean
  expectedSlippageBps:number
  estimatedTotalCostsMinor:bigint
  quoteReceivedAt:string
  authority:'SHARK_RESEARCH_ONLY'
  canAuthorizeTrade:false
}>
export type MemeWalletPaperState=Readonly<{
  day:string
  enteredMinor:bigint
  grossExposureMinor:bigint
  realizedLossMinor:bigint
  orders:number
  unresolvedIds:readonly string[]
  halted:boolean
}>
export type MemeWalletPaperDecision=Readonly<{
  decisionId:string
  walletId:string
  candidateCaseId:string
  proposedEntryMinor:bigint
  reasonCodes:readonly string[]
  disposition:'PAPER_ADMIT'|'PAPER_BLOCK'
  authority:'PAPER_SIMULATION_ONLY'
  canSign:false
  canExecute:false
  canMoveMoney:false
  requiresFreshOwnerApprovalForLive:true
  signerLeaseId:null
  executionPermitId:null
}>
export type MemeWalletPaperReceipt=Readonly<{
  decisionId:string
  state:'PAPER_FILLED'|'PAPER_FAILED'|'PAPER_UNKNOWN'
  inputMinor:bigint
  outputAtomic:string|null
  simulatedFeeMinor:bigint
  observedAt:string
  evidenceIds:readonly string[]
  authority:'SIMULATED_SETTLEMENT_ONLY'
  canExecute:false
}>
const ADDR=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function validSolanaAddress(s:string){
  if(!ADDR.test(s))return false
  let n=0n
  for(const c of s)n=n*58n+BigInt(B58.indexOf(c))
  let bytes=0
  for(let v=n;v>0n;v>>=8n)bytes++
  return bytes+s.length-s.replace(/^1+/,'').length===32
}
export function bindOwnerCreatedMemeWallet(input:Readonly<{
  solanaAddress:string
  ownerWalletAddresses:readonly string[]
  cofferWalletAddresses:readonly string[]
  mcpAgentAddresses:readonly string[]
  controlEvidence?:Readonly<{verified:boolean;address:string;challengeId:string}>
}>):MemeWalletResearchIdentity{
  const address=input.solanaAddress
  if(!validSolanaAddress(address))throw Error('MEME_WALLET_ADDRESS_INVALID')
  if([...input.ownerWalletAddresses,...input.cofferWalletAddresses,...input.mcpAgentAddresses].includes(address))
    throw Error('MEME_WALLET_ROLE_COLLISION')
  const verified=input.controlEvidence?.verified===true &&
    input.controlEvidence.address===address && Boolean(input.controlEvidence.challengeId.trim())
  return Object.freeze({
    walletId:'jhadina-owner-created:solana:'+address,solanaAddress:address,
    chain:'SOLANA_MAINNET',role:'JHADINA_OWNER_CREATED',
    control:verified?'CHALLENGE_VERIFIED':'UNVERIFIED',
    mcpWallet:'NOT_LINKED',signer:'DISABLED',
    financialAuthority:'NONE',canSign:false,canFund:false,canExecute:false,
  })
}
function sha(v:unknown){return createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')}
export function assessMemeWalletPaperCandidate(input:Readonly<{
  wallet:MemeWalletResearchIdentity
  policy:MemeWalletPaperPolicy
  candidate:MemeWalletCandidate
  state:MemeWalletPaperState
  entryMinor:bigint
  now:string
}>):MemeWalletPaperDecision{
  const {wallet,policy:p,candidate:c,state,entryMinor}=input
  const reasons:string[]=[]
  if(wallet.role!=='JHADINA_OWNER_CREATED'||wallet.signer!=='DISABLED'||wallet.canExecute!==false||
    wallet.canSign!==false||wallet.financialAuthority!=='NONE'||wallet.mcpWallet!=='NOT_LINKED')
    reasons.push('MEME_WALLET_IDENTITY_OR_AUTHORITY_INVALID')
  if(p.authority!=='PAPER_RISK_POLICY_ONLY'||p.paperOnly!==true||p.liveExecutionEnabled!==false||
    p.ownerReview!=='APPROVED_FOR_PAPER_ONLY'||!p.policyId)
    reasons.push('MEME_WALLET_PAPER_POLICY_NOT_APPROVED')
  if(entryMinor<=0n || p.maxPaperEntryMinor<=0n || entryMinor>p.maxPaperEntryMinor)
    reasons.push('MEME_WALLET_ENTRY_CAP')
  if(state.halted||state.unresolvedIds.length)reasons.push('MEME_WALLET_HALTED_OR_UNRESOLVED')
  if(state.enteredMinor<0n||state.grossExposureMinor<0n||state.realizedLossMinor<0n||
    state.orders<0||!Number.isSafeInteger(state.orders))reasons.push('MEME_WALLET_STATE_INVALID')
  if(state.enteredMinor+entryMinor>p.maxPaperDailyNotionalMinor ||
    state.grossExposureMinor+entryMinor>p.maxPaperGrossExposureMinor ||
    state.realizedLossMinor>=p.maxPaperDailyLossMinor || state.orders>=p.maxPaperOrdersPerDay)
    reasons.push('MEME_WALLET_PAPER_BUDGET_EXHAUSTED')
  const clock=Date.parse(input.now),quote=Date.parse(c.quoteReceivedAt),observation=Date.parse(c.observedAt)
  if(!Number.isFinite(clock)||!Number.isFinite(quote)||!Number.isFinite(observation)||
    quote>clock || clock-quote>p.maxQuoteAgeMs || observation>clock)
    reasons.push('MEME_WALLET_QUOTE_STALE_OR_INVALID')
  if(p.maxQuoteAgeMs<=0||p.maxQuoteAgeMs>120000||
    !Number.isInteger(p.maxSlippageBps)||p.maxSlippageBps<0||p.maxSlippageBps>1000||
    !Number.isInteger(p.maxPaperOrdersPerDay)||p.maxPaperOrdersPerDay<1||
    p.maxPaperDailyLossMinor<=0n||p.maxPaperGrossExposureMinor<=0n||
    p.maxPaperDailyNotionalMinor<=0n)reasons.push('MEME_WALLET_PAPER_POLICY_INVALID')
  if(c.authority!=='SHARK_RESEARCH_ONLY'||c.canAuthorizeTrade!==false||
    !c.caseId||!c.strategyId||!validSolanaAddress(c.tokenMint)||
    !validSolanaAddress(c.quoteMint)||!c.evidenceIds.length)
    reasons.push('MEME_WALLET_SHARK_EVIDENCE_INVALID')
  if(!p.allowedQuoteMints.includes(c.quoteMint))reasons.push('MEME_WALLET_QUOTE_MINT_DENIED')
  if(!c.liquidityVerified||!c.sellabilityVerified||!c.tokenPermissionsSafe||
    !c.holderConcentrationSafe||c.rugVeto)
    reasons.push('MEME_WALLET_RUG_OR_SELLABILITY_VETO')
  if(!Number.isInteger(c.expectedSlippageBps)||c.expectedSlippageBps<0||
    c.expectedSlippageBps>p.maxSlippageBps||c.estimatedTotalCostsMinor<0n ||
    c.estimatedTotalCostsMinor>=entryMinor)
    reasons.push('MEME_WALLET_COST_OR_SLIPPAGE_VETO')
  const decisionId='meme-wallet:paper:'+sha({walletId:wallet.walletId,candidate:c.caseId,entryMinor,policy:p.policyId,at:input.now})
  return Object.freeze({
    decisionId,walletId:wallet.walletId,candidateCaseId:c.caseId,
    proposedEntryMinor:entryMinor,
    reasonCodes:Object.freeze(reasons),
    disposition:reasons.length?'PAPER_BLOCK':'PAPER_ADMIT',
    authority:'PAPER_SIMULATION_ONLY',canSign:false,canExecute:false,canMoveMoney:false,
    requiresFreshOwnerApprovalForLive:true,signerLeaseId:null,executionPermitId:null,
  })
}
export function createMemeWalletPaperReceipt(input:Readonly<{
  decision:MemeWalletPaperDecision
  state:'PAPER_FILLED'|'PAPER_FAILED'|'PAPER_UNKNOWN'
  outputAtomic:string|null
  simulatedFeeMinor:bigint
  observedAt:string
  evidenceIds:readonly string[]
}>):MemeWalletPaperReceipt{
  if(input.decision.disposition!=='PAPER_ADMIT'||input.decision.canExecute!==false||
    input.simulatedFeeMinor<0n||!input.evidenceIds.length||
    !Number.isFinite(Date.parse(input.observedAt))||
    (input.state==='PAPER_FILLED'&&(!input.outputAtomic||!/^\d+$/.test(input.outputAtomic)))||
    (input.state!=='PAPER_FILLED'&&input.outputAtomic!==null))
    throw Error('MEME_WALLET_PAPER_RECEIPT_INVALID')
  return Object.freeze({
    decisionId:input.decision.decisionId,state:input.state,
    inputMinor:input.decision.proposedEntryMinor,outputAtomic:input.outputAtomic,
    simulatedFeeMinor:input.simulatedFeeMinor,
    observedAt:input.observedAt,evidenceIds:Object.freeze([...input.evidenceIds]),
    authority:'SIMULATED_SETTLEMENT_ONLY',canExecute:false,
  })
}

/** Future live policy can be evaluated for readiness, never activated here. */
export function evaluateMemeWalletFutureCanary(input:Readonly<{
  wallet:MemeWalletResearchIdentity
  policy:MemeWalletPaperPolicy
  proposedLiveLimits?:LiveCanaryPolicy
  signerIsolated:boolean
  signedOwnerMandateVerified:boolean
  onchainSellSimulationVerified:boolean
  durableReconciliationVerified:boolean
}>){
  const blockers:string[]=[]
  if(input.wallet.control!=='CHALLENGE_VERIFIED')blockers.push('WALLET_CONTROL_NOT_VERIFIED')
  if(!input.signerIsolated)blockers.push('SIGNER_ISOLATION_NOT_VERIFIED')
  if(!input.signedOwnerMandateVerified)blockers.push('SIGNED_OWNER_MANDATE_NOT_VERIFIED')
  if(!input.onchainSellSimulationVerified)blockers.push('SELL_SIMULATION_NOT_VERIFIED')
  if(!input.durableReconciliationVerified)blockers.push('RECONCILIATION_NOT_VERIFIED')
  if(!input.proposedLiveLimits || input.proposedLiveLimits.authority!=='RISK_POLICY_ONLY')
    blockers.push('COFFER_LIMIT_POLICY_NOT_CERTIFIED')
  blockers.push('LIVE_COMMISSIONING_SEPARATELY_REQUIRED')
  return Object.freeze({
    status:'BLOCKED' as const,blockers:Object.freeze(blockers),
    authority:'FUTURE_CANARY_REVIEW_ONLY' as const,
    canSign:false as const,canExecute:false as const,
    canFund:false as const,liveTradingEnabled:false as const,
  })
}
