import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,writeFile,chmod} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {hashDexRuntime,type DexSwapIntent,type DexExecutionAttempt,
 type DexOnchainReceipt} from './solana-dex-runtime-contracts.js'
import {reserveSniperCofferResearch,markSniperCofferUnknown,
 haltSniperCofferResearch,recoverSniperCofferResearch,
 recordSniperCofferSettlementObservation} from './sniper-coffer-research-ledger.js'
const now='2026-10-23T19:00:00Z'
const base={
 executionId:'execution:research:1',tradeId:'trade:research:1',
 requestId:'request:research:1',runLineageId:'lineage:research:1',
 userId:'owner:1',strategyId:'sniper-canary',instrumentId:'solana:token',
 leg:'ENTRY' as const,provider:'jupiter-ultra' as const,
 walletConnectionId:'coffer:isolated',signerLeaseId:'lease:1',
 inputMint:'2'.repeat(32),outputMint:'3'.repeat(32),
 inputAmountAtomic:1000n,minimumOutputAtomic:900n,notionalMinor:1000n,
 currency:'LAMPORTS',idempotencyKey:'idempotency:research:1',
 informationCutoff:'2026-10-23T18:59:59Z',
}
const makeIntent=(suffix='1'):DexSwapIntent=>{
 const core={...base,executionId:'execution:research:'+suffix,
  idempotencyKey:'idempotency:research:'+suffix,
  tradeId:'trade:research:'+suffix}
 const binding={
  sharkAssessmentId:'risk:1',thesisId:'thesis:1',
  edgeDecisionBundleHash:'edge:1',integrityGuardHash:'integrity:1',
  moneyRiskDecisionId:'Money:1',
  intentFingerprint:hashDexRuntime({...core,inputAmountAtomic:'1000',
   minimumOutputAtomic:'900',notionalMinor:'1000'}),
  approvedAt:'2026-10-23T18:59:59Z',
  authority:'MONEY_RISK_APPROVAL_BINDING' as const,
 }
 return {...core,approval:{...binding,bindingHash:hashDexRuntime(binding)},
  evidenceIds:['verified:original','risk:approved'],
  authority:'MONEY_EXECUTION_INTENT'}
}
const guard={
 version:1,observedAt:now,halted:false,walletConnectionId:'coffer:isolated',
 tradingDay:'2026-10-23',unresolvedExecutionIds:[],
 submittedTodayMinor:0n,lossTodayMinor:0n,
 authority:'CANONICAL_GUARD_SNAPSHOT_ONLY' as const,
}
const policy={
 maxSingleMinor:2000n,maxDailySubmittedMinor:2500n,maxDailyLossMinor:500n,
 maxObservationAgeMs:3000,authority:'RESEARCH_BUDGET_POLICY_ONLY' as const,
}
const prep=(root:string,suffix='1')=>({
 root,intent:makeIntent(suffix),guard,policy,now,
})
const attempt=(i:DexSwapIntent):DexExecutionAttempt=>({
 attemptId:'attempt:one',executionId:i.executionId,
 requestId:i.requestId,runLineageId:i.runLineageId,leg:'ENTRY',
 provider:'jupiter-ultra',walletConnectionId:i.walletConnectionId,
 signerLeaseId:i.signerLeaseId,idempotencyKey:i.idempotencyKey,
 inputMint:i.inputMint,outputMint:i.outputMint,
 inputAmountAtomic:i.inputAmountAtomic,minimumOutputAtomic:i.minimumOutputAtomic,
 signedTransactionHash:'sha:real-signature',primarySignature:'signature:confirmed',
 providerRequestId:'jupiter:managed:1',
 simulatedFeeLamports:5000n,state:'RECONCILED',
 startedAt:now,updatedAt:now,evidenceIds:['canonical:attempt'],
 authority:'EXECUTION_ATTEMPT_ONLY',
})
const onchain=(i:DexSwapIntent):DexOnchainReceipt=>({
 signature:'signature:confirmed',found:true,confirmed:true,failed:false,
 slot:123456,feeLamports:5000n,inputDebitAtomic:i.inputAmountAtomic,
 outputCreditAtomic:950n,observedAt:now,
 evidenceIds:['independent:chain'],
 authority:'ONCHAIN_EVIDENCE',
})
async function withDir(run:(root:string)=>Promise<void>){
 const root=await mkdtemp(join(tmpdir(),'sniper-coffer-'))
 try{await run(root)}finally{await rm(root,{recursive:true,force:true})}
}
test('single durable reservation never signs, duplicate replay stays rejected across restart',async()=>{
 await withDir(async root=>{
  const initial=await reserveSniperCofferResearch(prep(root))
  assert.equal(initial.status,'RESERVED_RESEARCH_ONLY',initial.reasonCodes.join(','))
  assert.equal(initial.canSign,false);assert.equal(initial.canSubmit,false)
  assert.equal((await recoverSniperCofferResearch(root)).outstanding.length,1)
  const retry=await reserveSniperCofferResearch(prep(root))
  assert.equal(retry.status,'REPLAY_BLOCKED')
  const other=await reserveSniperCofferResearch(prep(root,'2'))
  assert.ok(other.reasonCodes.includes('UNRESOLVED_LOCAL_ATTEMPT'))
 })
})
test('exclusive writer lease means simultaneous same-intent enrollments cannot both succeed',async()=>{
 await withDir(async root=>{
  const results=await Promise.allSettled([
   reserveSniperCofferResearch(prep(root)),
   reserveSniperCofferResearch(prep(root)),
   reserveSniperCofferResearch(prep(root)),
  ])
  assert.equal(results.filter(r=>r.status==='fulfilled'&&
   r.value.status==='RESERVED_RESEARCH_ONLY').length,1)
  assert.equal((await recoverSniperCofferResearch(root)).outstanding.length,1)
 })
})
test('unknown settlement and orphaned lock stop all automatic restarts',async()=>{
 await withDir(async root=>{
  await reserveSniperCofferResearch(prep(root))
  await markSniperCofferUnknown({root,idempotencyKey:makeIntent().idempotencyKey,now})
  const recovered=await recoverSniperCofferResearch(root)
  assert.equal(recovered.outstanding[0]?.state,'UNKNOWN_NEEDS_RECONCILIATION')
  assert.equal(recovered.canRetry,false)
  const blocked=await reserveSniperCofferResearch(prep(root,'2'))
  assert.ok(blocked.reasonCodes.includes('UNRESOLVED_LOCAL_ATTEMPT'))
  await writeFile(join(root,'.sniper-coffer.lock'),'crash',{mode:0o600})
  await assert.rejects(recoverSniperCofferResearch(root),/OPERATOR_RECONCILIATION_REQUIRED/)
 })
})
test('only canonical matched settlement observation closes a research hold without Purse credit',async()=>{
 await withDir(async root=>{
  const i=makeIntent()
  await reserveSniperCofferResearch(prep(root))
  await assert.rejects(recordSniperCofferSettlementObservation({
   root,intent:i,attempt:{...attempt(i),state:'UNKNOWN'},onchain:onchain(i),now,
  }),/CANONICAL_SETTLEMENT_UNVERIFIED/)
  assert.equal((await recoverSniperCofferResearch(root)).outstanding.length,1)
  const matching=await recordSniperCofferSettlementObservation({
   root,intent:i,attempt:attempt(i),onchain:onchain(i),now,
  })
  assert.equal(matching.state,'OBSERVED_RECONCILED')
  assert.equal(matching.canSign,false)
  const recovered=await recoverSniperCofferResearch(root)
  assert.equal(recovered.outstanding.length,0)
  assert.equal(recovered.observedReconciled,1)
  assert.equal(recovered.canCreditPurse,false)
  const following=await reserveSniperCofferResearch(prep(root,'2'))
  assert.equal(following.status,'RESERVED_RESEARCH_ONLY')
  assert.equal((await recoverSniperCofferResearch(root)).outstanding.length,1)
 })
})
test('daily limit cannot be evaded by reconciliation or retries',async()=>{
 await withDir(async root=>{
  await reserveSniperCofferResearch(prep(root))
  const i=makeIntent()
  await recordSniperCofferSettlementObservation({
   root,intent:i,attempt:attempt(i),onchain:onchain(i),now,
  })
  const failed=await reserveSniperCofferResearch({
   ...prep(root,'2'),policy:{...policy,maxDailySubmittedMinor:1500n},
  })
  assert.equal(failed.status,'BUDGET_OR_GUARD_BLOCKED')
  assert.ok(failed.reasonCodes.includes('OWNER_RESEARCH_CAP_EXCEEDED'))
 })
})
test('owner halt persists through restart and can never be silently reset',async()=>{
 await withDir(async root=>{
  const halted=await haltSniperCofferResearch({
   root,reason:'owner emergency revoke',now,
  })
  assert.equal(halted.canSign,false)
  assert.equal((await recoverSniperCofferResearch(root)).halted,true)
  const blocked=await reserveSniperCofferResearch(prep(root))
  assert.equal(blocked.status,'BUDGET_OR_GUARD_BLOCKED')
  assert.equal(blocked.canSign,false)
 })
})
test('unsafe world-readable volume refused before any research reservation',async()=>{
 await withDir(async root=>{
  await chmod(root,0o755)
  await assert.rejects(reserveSniperCofferResearch(prep(root)),/PRIVATE_VOLUME_REQUIRED/)
 })
})
