import test from 'node:test'
import assert from 'node:assert/strict'
import { submitMemeWalletPaperProposal, recordMemeWalletPaperSettlement, type MemeWalletPaperJournal } from './meme-wallet-paper-runtime.js'
import {
  bindOwnerCreatedMemeWallet,assessMemeWalletPaperCandidate,
  createMemeWalletPaperReceipt,evaluateMemeWalletFutureCanary,
  type MemeWalletPaperPolicy,type MemeWalletCandidate,type MemeWalletPaperState,
} from './meme-wallet-paper-gate.js'

const address='So11111111111111111111111111111111111111112'
const quote='11111111111111111111111111111111'
const wallet=bindOwnerCreatedMemeWallet({
  solanaAddress:address,ownerWalletAddresses:[],cofferWalletAddresses:[],mcpAgentAddresses:[],
})
const policy:MemeWalletPaperPolicy={
  policyId:'MEME-WALLET-PAPER-001',ownerReview:'APPROVED_FOR_PAPER_ONLY',
  paperOnly:true,liveExecutionEnabled:false,maxPaperEntryMinor:1000n,
  maxPaperDailyNotionalMinor:3000n,maxPaperGrossExposureMinor:2000n,
  maxPaperDailyLossMinor:500n,maxPaperOrdersPerDay:3,maxSlippageBps:300,
  maxQuoteAgeMs:10000,allowedQuoteMints:[quote],authority:'PAPER_RISK_POLICY_ONLY',
}
const candidate:MemeWalletCandidate={
  caseId:'shark:meme:paper:001',strategyId:'sniper-paper',
  tokenMint:address,quoteMint:quote,observedAt:'2026-10-14T20:00:00Z',
  quoteReceivedAt:'2026-10-14T20:00:02Z',
  evidenceIds:['shark:case:001','solana:pool:001'],liquidityVerified:true,
  sellabilityVerified:true,tokenPermissionsSafe:true,holderConcentrationSafe:true,
  rugVeto:false,expectedSlippageBps:150,estimatedTotalCostsMinor:40n,
  authority:'SHARK_RESEARCH_ONLY',canAuthorizeTrade:false,
}
const state:MemeWalletPaperState={
  day:'2026-10-14',enteredMinor:0n,grossExposureMinor:0n,
  realizedLossMinor:0n,orders:0,unresolvedIds:[],halted:false,
}
const args={wallet,policy,candidate,state,entryMinor:400n,now:'2026-10-14T20:00:04Z'}

test('01 verified public Solana address still does not grant signing authority',()=>{
  assert.equal(wallet.control,'UNVERIFIED')
  assert.equal(wallet.signer,'DISABLED')
  assert.equal(wallet.canSign,false)
  assert.equal(wallet.canFund,false)
  assert.equal(wallet.canExecute,false)
  assert.throws(()=>bindOwnerCreatedMemeWallet({
    solanaAddress:address,ownerWalletAddresses:[address],cofferWalletAddresses:[],mcpAgentAddresses:[],
  }),/MEME_WALLET_ROLE_COLLISION/)
  const verified=bindOwnerCreatedMemeWallet({
    solanaAddress:address,ownerWalletAddresses:[],cofferWalletAddresses:[],mcpAgentAddresses:[],
    controlEvidence:{verified:true,address,challengeId:'verified-challenge'},
  })
  assert.equal(verified.control,'CHALLENGE_VERIFIED')
  assert.equal(verified.canExecute,false)
})

test('02–05 SHARK paper candidate admits only fresh evidence under capped owner-approved paper policy',()=>{
  const result=assessMemeWalletPaperCandidate(args)
  assert.equal(result.disposition,'PAPER_ADMIT')
  assert.equal(result.canExecute,false)
  assert.equal(result.signerLeaseId,null)
  assert.equal(result.executionPermitId,null)
  assert.equal(result.requiresFreshOwnerApprovalForLive,true)
  const receipt=createMemeWalletPaperReceipt({
    decision:result,state:'PAPER_FILLED',outputAtomic:'100',
    simulatedFeeMinor:15n,observedAt:args.now,evidenceIds:['paper:sim:001'],
  })
  assert.equal(receipt.authority,'SIMULATED_SETTLEMENT_ONLY')
  assert.equal(receipt.canExecute,false)
  assert.throws(()=>createMemeWalletPaperReceipt({
    decision:result,state:'PAPER_UNKNOWN',outputAtomic:'100',
    simulatedFeeMinor:15n,observedAt:args.now,evidenceIds:['paper:sim:001'],
  }),/MEME_WALLET_PAPER_RECEIPT_INVALID/)
})

test('03 stale quote, liquidity, sellability and rug signals veto paper entry',()=>{
  for(const patch of [
    {rugVeto:true},{sellabilityVerified:false},{liquidityVerified:false},
    {tokenPermissionsSafe:false},{holderConcentrationSafe:false},
    {expectedSlippageBps:500},{quoteReceivedAt:'2026-10-14T19:00:00Z'},
    {evidenceIds:[]},
  ]){
    const decision=assessMemeWalletPaperCandidate({
      ...args,candidate:{...candidate,...patch},
    })
    assert.equal(decision.disposition,'PAPER_BLOCK')
    assert.equal(decision.canExecute,false)
  }
})

test('04 daily limits, unknown fills and halted system block further paper entries',()=>{
  const invalid=[
    {enteredMinor:2900n},{grossExposureMinor:1900n},{realizedLossMinor:500n},
    {orders:3},{unresolvedIds:['paper:unknown:001']},{halted:true},
  ]
  for(const patch of invalid){
    const decision=assessMemeWalletPaperCandidate({...args,state:{...state,...patch}})
    assert.equal(decision.disposition,'PAPER_BLOCK')
  }
})

test('05 owner paper authorization is not a live execution mandate',()=>{
  const decision=assessMemeWalletPaperCandidate({
    ...args,policy:{...policy,ownerReview:'PENDING'},
  })
  assert.equal(decision.disposition,'PAPER_BLOCK')
  const unsafe=assessMemeWalletPaperCandidate({
    ...args,policy:{...policy,liveExecutionEnabled:true} as unknown as MemeWalletPaperPolicy,
  })
  assert.equal(unsafe.disposition,'PAPER_BLOCK')
})

test('06–08 live signer remains disabled even with all hypothetical readiness flags',()=>{
  const result=evaluateMemeWalletFutureCanary({
    wallet:bindOwnerCreatedMemeWallet({
      solanaAddress:address,ownerWalletAddresses:[],cofferWalletAddresses:[],mcpAgentAddresses:[],
      controlEvidence:{verified:true,address,challengeId:'verified'},
    }),
    policy,signerIsolated:true,signedOwnerMandateVerified:true,
    onchainSellSimulationVerified:true,durableReconciliationVerified:true,
  })
  assert.equal(result.status,'BLOCKED')
  assert.equal(result.canExecute,false)
  assert.equal(result.canFund,false)
  assert.equal(result.liveTradingEnabled,false)
  assert.ok(result.blockers.includes('COFFER_LIMIT_POLICY_NOT_CERTIFIED'))
  assert.ok(result.blockers.includes('LIVE_COMMISSIONING_SEPARATELY_REQUIRED'))
})

test('paper journal records one proposal, separates outcomes, and blocks duplicate simulated fills',async()=>{
  const saved=new Map<string,{decision:ReturnType<typeof assessMemeWalletPaperCandidate>;receipt:ReturnType<typeof createMemeWalletPaperReceipt>|null}>()
  const journal:MemeWalletPaperJournal={
    async getByCase(id,caseId){return saved.get(id+'|'+caseId)??null},
    async appendDecision(decision){
      const key=wallet.walletId+'|'+candidate.caseId
      if(saved.has(key))throw Error('DUPLICATE_PAPER_CANDIDATE')
      saved.set(key,{decision,receipt:null})
    },
    async appendReceipt(receipt){
      const key=wallet.walletId+'|'+candidate.caseId
      const existing=saved.get(key)
      if(!existing||existing.receipt)throw Error('DUPLICATE_PAPER_SETTLEMENT')
      saved.set(key,{...existing,receipt})
    },
  }
  const first=await submitMemeWalletPaperProposal({...args,journal})
  assert.equal(first.decision.disposition,'PAPER_ADMIT')
  assert.equal(first.recoveredExisting,false)
  assert.equal(first.canExecute,false)
  const next=await submitMemeWalletPaperProposal({...args,journal})
  assert.equal(next.recoveredExisting,true)
  assert.equal(next.decision.decisionId,first.decision.decisionId)
  const fill=await recordMemeWalletPaperSettlement({
    journal,walletId:wallet.walletId,candidateCaseId:candidate.caseId,
    state:'PAPER_FILLED',outputAtomic:'155',simulatedFeeMinor:10n,
    observedAt:args.now,evidenceIds:['paper:simulated-fill:1'],
  })
  assert.equal(fill.authority,'SIMULATED_SETTLEMENT_ONLY')
  assert.equal(fill.canExecute,false)
  await assert.rejects(recordMemeWalletPaperSettlement({
    journal,walletId:wallet.walletId,candidateCaseId:candidate.caseId,
    state:'PAPER_FILLED',outputAtomic:'155',simulatedFeeMinor:10n,
    observedAt:args.now,evidenceIds:['paper:simulated-fill:1'],
  }),/MEME_WALLET_PAPER_SETTLEMENT_ALREADY_RECORDED/)
})
