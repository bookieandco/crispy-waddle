import test from 'node:test'
import assert from 'node:assert/strict'
import {hashDexRuntime,type DexSwapIntent,type DexManagedOrder,type DexExecutionAttempt,
 type DexOnchainReceipt} from './solana-dex-runtime-contracts.js'
import {reviewSniperLiveEntry,reviewSniperOnchainSettlement,
 reviewSniperCofferExit,type SniperEntryReviewInput} from './sniper-live-canary-gate.js'
const time='2026-10-23T12:00:00.400Z'
const quoteAt='2026-10-23T12:00:00.300Z'
const expires='2026-10-23T12:00:00.900Z'
const coffer='coffer:isolated'
const address='4'.repeat(44)
const inputMint='2'.repeat(32),outputMint='3'.repeat(32)
const draft={
 executionId:'execution:1',tradeId:'trade:1',requestId:'req:1',
 runLineageId:'lineage:1',userId:'owner:1',strategyId:'sniper-v1',
 instrumentId:'solana:'+inputMint,leg:'ENTRY' as const,provider:'jupiter-ultra' as const,
 walletConnectionId:coffer,signerLeaseId:'lease:1',
 inputMint,outputMint,inputAmountAtomic:1000000n,
 minimumOutputAtomic:980000n,notionalMinor:1000000n,
 currency:'LAMPORTS',idempotencyKey:'sniper:entry:1',
 informationCutoff:'2026-10-23T12:00:00.300Z',
}
const fingerprint=hashDexRuntime({...draft,
 inputAmountAtomic:draft.inputAmountAtomic.toString(),
 minimumOutputAtomic:draft.minimumOutputAtomic.toString(),
 notionalMinor:draft.notionalMinor.toString(),
})
const approvalBase={
 sharkAssessmentId:'risk:pass:1',thesisId:'thesis:1',edgeDecisionBundleHash:'edge:hash',
 integrityGuardHash:'integrity:hash',moneyRiskDecisionId:'money:approve:1',
 intentFingerprint:fingerprint,approvedAt:'2026-10-23T12:00:00.350Z',
 authority:'MONEY_RISK_APPROVAL_BINDING' as const,
}
const intent: DexSwapIntent={
 ...draft,approval:{...approvalBase,bindingHash:hashDexRuntime(approvalBase)},
 evidenceIds:['original-chain:tx','money:approved'],authority:'MONEY_EXECUTION_INTENT',
}
const order:DexManagedOrder={
 provider:'jupiter-ultra',requestId:'jupiter:1',
 inputMint,outputMint,inputAmountAtomic:draft.inputAmountAtomic,
 quotedOutputAtomic:1000000n,unsignedTransactionBase64:'HERMETIC_FIXTURE_NO_SIGN',
 takerAddress:address,evidenceIds:['quote:1'],authority:'PROVIDER_QUOTE_ONLY',
 canBroadcast:false,
}
const review=():SniperEntryReviewInput=>({
 intent,quote:{
  quoteId:order.requestId,order,observedAt:quoteAt,expiresAt:expires,
  priceImpactBps:80,instructionReviewEvidenceIds:['instruction-decoder:independent'],
  estimatedPriorityFeeLamports:2000n,estimatedJitoTipLamports:0n,
  estimatedBaseFeeLamports:5000n,source:'JUPITER_ORDER_CANDIDATE',
  transactionInstructionsVerified:true,
 },
 entryClock:{
  eventObservedAt:'2026-10-23T12:00:00.000Z',
  serverReceivedAt:'2026-10-23T12:00:00.100Z',
  riskEvidenceAvailableAt:'2026-10-23T12:00:00.200Z',
  selectedQuoteAvailableAt:quoteAt,
  entryOrderExpiresAt:expires,
  now:time,hasOpenPosition:false,unresolvedExitAttempt:false,
  policy:{maxOpportunityAgeMs:1500,maxProviderToReceiptMs:1000,
   maxRiskEvidenceAgeMs:600,maxSelectedQuoteAgeMs:250,minOrderRemainingMs:100},
 },
 confirmedMintSignature:'chain:independently-verified',
 onchainMintAttested:true,riskDisposition:'PAPER_CANDIDATE',
 riskEvidenceAvailableAt:'2026-10-23T12:00:00.200Z',
 ownerWalletConnectionId:'phantom:main',
 cofferWalletConnectionId:coffer,cofferWalletAddress:address,
 signerPolicy:{walletConnectionId:coffer,agentId:'jhadina',sessionId:'session:1',
  perTransactionCapMinor:1500000n,rolling24hCapMinor:5000000n,
  maxTransactionCount:10,allowedDestinationAddresses:[address],
  allowedAssets:[inputMint,outputMint],authority:'OWNER_SIGNER_POLICY'},
 signerLease:{leaseId:'lease:1',walletConnectionId:coffer,agentId:'jhadina',sessionId:'session:1',
  tokenFingerprint:'lease:token-hash',issuedAt:'2026-10-23T11:50:00Z',
  expiresAt:'2026-10-23T12:10:00Z',state:'ACTIVE',
  authority:'LEASE_METADATA_ONLY',containsPrivateKey:false,containsRawToken:false},
 signerObservation:{leaseId:'lease:1',spent24hMinor:0n,transactionCount24h:0,
  observedAt:'2026-10-23T12:00:00.100Z',evidenceIds:['signer-state:1'],authority:'SIGNER_EVIDENCE'},
 readiness:{ready:true,status:'READY_FOR_CONTROLLED_CANARY',blockerCodes:[],checks:[],
  authority:'READINESS_ONLY',canExposeSecrets:false},
 canaryPolicy:{policyId:'live:canary:proposal',currency:'LAMPORTS',
  maxOrderNotionalMinor:1500000n,maxDailySubmittedNotionalMinor:5000000n,
  maxDailyOrders:10,maxDailyRealizedLossMinor:500000n,
  maxGrossExposureMinor:5000000n,maxOpenUnknownExecutions:0,
  maxRiskMetricAgeSeconds:10,authority:'RISK_POLICY_ONLY'},
 canaryState:{provider:'jupiter-ultra',accountId:coffer,tradingDate:'2026-10-23',
  currency:'LAMPORTS',submittedNotionalMinor:0n,submittedOrders:0,
  realizedLossMinor:0n,grossExposureMinor:0n,unresolvedExecutionIds:[],
  riskMetricEvidenceIds:['risk:1'],halted:false,version:1,updatedAt:time},
 solFeeReserveLamports:200000n,hasUnresolvedEntry:false,
 unresolvedExitCount:0,killSwitchActive:false,
 policy:{policyId:'sniper:policy:proposal',maxOrderAgeMs:800,
  maxQuoteAgeMs:250,maxSlippageBps:250,maxPriceImpactBps:500,
  maxEstimatedFeesLamports:10000n,maxDailyLossMinor:500000n,
  maxUnresolvedExits:0,minSolFeeReserveLamports:100000n,
  authority:'SNIPER_LIVE_REVIEW_POLICY'},
 now:time,
})
test('even an apparently healthy fixture is BLOCKED without semantic byte verification',()=>{
 const result=reviewSniperLiveEntry(review())
 assert.equal(result.status,'BLOCKED')
 assert.ok(result.reasonCodes.includes('UNSIGNED_TRANSACTION_BYTE_AUDIT_REQUIRED'))
 assert.ok(result.reasonCodes.includes('TRANSACTION_SEMANTIC_DECODER_NOT_COMMISSIONED'))
 assert.equal(result.canSign,false)
 assert.equal(result.canSubmit,false)
 assert.equal(result.canTrade,false)
 assert.equal(result.canCreditPurse,false)
 assert.equal(result.totalEstimatedFeeLamports,7000n)
})
test('no permission from a Phantom owner observation or nonexistent isolated Coffer',()=>{
 const base=review()
 const r=reviewSniperLiveEntry({...base,cofferWalletConnectionId:base.ownerWalletConnectionId})
 assert.equal(r.status,'BLOCKED')
 assert.ok(r.reasonCodes.includes('OWNER_COFFER_WALLET_NOT_ISOLATED'))
})
test('block stale quotes, slippage, price impact, excess tips, bad lease, unknown exits',()=>{
 const base=review()
 const cases:[Partial<SniperEntryReviewInput>,string][]=[
  [{now:'2026-10-23T12:00:01.500Z'},'JUPITER_ORDER_STALE'],
  [{policy:{...base.policy,maxSlippageBps:100}},'SLIPPAGE_LIMIT'],
  [{policy:{...base.policy,maxPriceImpactBps:10}},'PRICE_IMPACT_LIMIT'],
  [{quote:{...base.quote!,estimatedJitoTipLamports:100000n}},'FEE_CAP_OR_RESERVE_EXCEEDED'],
  [{signerLease:{...base.signerLease,state:'REVOKED'}},'SIGNER_LEASE_POLICY_NOT_SATISFIED'],
  [{unresolvedExitCount:1},'PREVIOUS_EXIT_UNRECONCILED'],
  [{hasUnresolvedEntry:true},'PREVIOUS_ENTRY_UNRECONCILED'],
  [{killSwitchActive:true},'KILL_SWITCH_ACTIVE'],
  [{riskDisposition:'BLOCK'},'SHARK_RISK_NOT_ACCEPTED'],
  [{onchainMintAttested:false},'CHAIN_MINT_NOT_ATTESTED'],
  [{signerObservation:{...base.signerObservation,
    observedAt:'2026-10-23T11:59:00Z'}},'SIGNER_OBSERVATION_STALE'],
  [{canaryState:{...base.canaryState!,updatedAt:'2026-10-23T11:59:00Z'}},'CANARY_RISK_METRIC_STALE'],
  [{signerPolicy:{...base.signerPolicy,allowedAssets:[inputMint]}},'SIGNER_OUTPUT_MINT_NOT_ALLOWED'],
  [{quote:{...base.quote!,instructionReviewEvidenceIds:[]}},'TRANSACTION_INSTRUCTION_ATTESTATION_REQUIRED'],
 ]
 for(const [patch,code] of cases){
  const r=reviewSniperLiveEntry({...base,...patch})
  assert.equal(r.status,'BLOCKED',code)
  assert.ok(r.reasonCodes.includes(code),code+': '+r.reasonCodes.join(','))
  assert.equal(r.canSubmit,false)
 }
})
test('a forged true instructionsVerified boolean cannot bypass the byte-verified gate',()=>{
 const base=review()
 const forged=reviewSniperLiveEntry({...base,quote:{
  ...base.quote!,transactionInstructionsVerified:true,
  instructionReviewEvidenceIds:['fabricated:independent'],
  byteAudit:{
   version:'SHARK-SNIPER.LIVE-GATE.31',orderRequestId:base.quote!.order.requestId,
   transactionSha256:'0'.repeat(64),format:'V0',status:'STRUCTURE_OBSERVED',
   reasonCodes:[],feePayer:address,signerCount:1,staticAccounts:2,
   instructionCount:1,programIds:['arbitrary:program'],
   semanticAuthorized:false,altResolved:false,canSign:false,
   canSubmit:false,canTrade:false,authority:'UNSIGNED_TRANSACTION_STRUCTURE_ONLY',
  },
 }})
 assert.equal(forged.status,'BLOCKED')
 assert.ok(forged.reasonCodes.includes('UNSIGNED_TRANSACTION_BYTE_BINDING_INVALID'))
 assert.ok(forged.reasonCodes.includes('TRANSACTION_SEMANTIC_DECODER_NOT_COMMISSIONED'))
 assert.equal(forged.canSign,false)
})
test('never accept original owner as Jupiter taker or a substituted quote',()=>{
 const base=review()
 const forged=reviewSniperLiveEntry({...base,quote:{...base.quote!,
  order:{...order,takerAddress:'phantom:main'}}})
 assert.ok(forged.reasonCodes.includes('JUPITER_ORDER_BINDING_MISMATCH'))
 const mismatched=reviewSniperLiveEntry({...base,quote:{...base.quote!,
  observedAt:'2026-10-23T12:00:00.320Z'}})
 assert.ok(mismatched.reasonCodes.includes('FASTLANE_SELECTED_QUOTE_NOT_BOUND'))
})
test('matching chain snapshot never directly settles or releases execution authority',()=>{
 const base=review(),i=base.intent
 const attempt:DexExecutionAttempt={
  attemptId:'a:1',executionId:i.executionId,requestId:i.requestId,runLineageId:i.runLineageId,
  leg:'ENTRY',provider:'jupiter-ultra',walletConnectionId:coffer,signerLeaseId:'lease:1',
  idempotencyKey:i.idempotencyKey,inputMint,outputMint,inputAmountAtomic:i.inputAmountAtomic,
  minimumOutputAtomic:i.minimumOutputAtomic,signedTransactionHash:'signed:hash',
  primarySignature:'tx:signature',providerRequestId:'jupiter:1',
  simulatedFeeLamports:5000n,state:'RECONCILED',startedAt:time,updatedAt:time,
  evidenceIds:['attempt:1'],authority:'EXECUTION_ATTEMPT_ONLY',
 }
 const onchain:DexOnchainReceipt={
  signature:'tx:signature',found:true,confirmed:true,failed:false,slot:123,
  inputDebitAtomic:1000000n,outputCreditAtomic:990000n,feeLamports:5000n,
  observedAt:time,evidenceIds:['chain:tx'],authority:'ONCHAIN_EVIDENCE',
 }
 const ok=reviewSniperOnchainSettlement({intent:i,attempt,onchain})
 assert.equal(ok.state,'MATCHED_OBSERVATION',ok.reasonCodes.join(','))
 assert.equal(ok.canCreditPurse,false)
 assert.equal(ok.canRetryOrder,false)
 const unknown=reviewSniperOnchainSettlement({intent:i,attempt:{...attempt,state:'UNKNOWN'},
  onchain:{...onchain,signature:'other-tx'}})
 assert.equal(unknown.state,'FAILED_OR_UNKNOWN')
 assert.ok(unknown.reasonCodes.includes('SIGNATURE_MISMATCH'))
 const pending=reviewSniperOnchainSettlement({intent:i,attempt,onchain:undefined})
 assert.equal(pending.state,'PENDING_RECONCILIATION')
 assert.equal(pending.canRetryOrder,false)
 const failed=reviewSniperOnchainSettlement({intent:i,attempt:{...attempt,state:'FAILED'},onchain})
 assert.equal(failed.state,'FAILED_OR_UNKNOWN')
 assert.ok(failed.reasonCodes.includes('CANONICAL_RUNTIME_RECONCILIATION_REQUIRED'))
 const wrongLease=reviewSniperOnchainSettlement({intent:i,
  attempt:{...attempt,signerLeaseId:'unexpected-lease'},onchain})
 assert.equal(wrongLease.state,'FAILED_OR_UNKNOWN')
 assert.ok(wrongLease.reasonCodes.includes('ATTEMPT_NOT_RECONCILED_TO_INTENT'))
})
test('Money exit sentinel controls fast exits; unknown settlement blocks duplicate sell',()=>{
 const p={positionId:'p:1',tokenAddress:inputMint,entryConfirmedAt:'2026-10-23T11:59:00Z',
  openTokenAmountAtomic:100n,peakReturnBps:500,markedReturnBps:-2000,
  availableAt:time,evidenceIds:['pos:1']}
 const policy={maxHoldSeconds:30,profitTakeBps:300,trailingGivebackBps:100,
  maxDrawdownBps:1000,maxQuoteAgeMs:300}
 const quote={quoteId:'exit-route:1',tokenAddress:inputMint,sellAmountAtomic:100n,
  quotedAt:quoteAt,expiresAt:expires,minimumProceedsLamports:1000n,
  evidenceIds:['sell:1'],verifiedSellPath:true}
 const candidate=reviewSniperCofferExit({position:p,quote,policy,now:time,
  entryReconciled:true,hasUnknownExitAttempt:false,killSwitchActive:false})
 assert.equal(candidate.status,'EXIT_REVIEW_CANDIDATE')
 assert.equal(candidate.canSubmit,false)
 const pending=reviewSniperCofferExit({position:{...p,openTokenAmountAtomic:0n},quote,
  policy,now:time,entryReconciled:true,hasUnknownExitAttempt:true,killSwitchActive:false})
 assert.equal(pending.status,'RECONCILE_FIRST')
 const noRoute=reviewSniperCofferExit({position:p,policy,now:time,
  entryReconciled:true,hasUnknownExitAttempt:false,killSwitchActive:false})
 assert.equal(noRoute.status,'NO_SELL_ROUTE')
 assert.equal(noRoute.canExecute,false)
})
