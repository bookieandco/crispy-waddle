import test from 'node:test'
import assert from 'node:assert/strict'
import {hashDexRuntime,type DexSwapIntent,type DexManagedOrder} from './solana-dex-runtime-contracts.js'
import {sha256UnsignedTransaction} from './sniper-transaction-byte-audit.js'
import {decodeSignerMessage,type SniperAltObservation} from './sniper-signer-message.js'
import {certifySniperSignerCandidate,type SniperSignerGuard,
 type SniperSignerSimulation} from './sniper-signer-certification.js'
const ABC='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function b58(bytes:Uint8Array):string{
 let n=0n
 for(const b of bytes)n=(n<<8n)|BigInt(b)
 let s=''
 while(n){s=ABC[Number(n%58n)]+s;n/=58n}
 let z=0;while(z<bytes.length&&bytes[z]===0)z++
 return '1'.repeat(z)+s
}
const key=(n:number)=>Buffer.alloc(32,n),addr=(n:number)=>b58(key(n))
const payer=addr(7),program=addr(9),table=addr(10)
const inputToken=addr(11),outputToken=addr(12),inputMint=addr(13),outputMint=addr(14)
const blockhash=addr(5)
const at='2026-10-23T12:00:00.500Z'
const message=(opts:{version?:number;withLookup?:boolean;programIx?:number;
 extra?:number[];signatureValue?:number}={}):string=>{
 const lookup=opts.withLookup??true
 const ix=Buffer.from([opts.programIx??1,3,0,2,3,1,4])
 const parts=[
  Buffer.from([1]),Buffer.alloc(64,opts.signatureValue??0),
  Buffer.from([opts.version??0x80,1,0,1,2]),
  key(7),key(9),key(5),
  Buffer.from([1]),ix,
  Buffer.from([lookup?1:0]),
 ]
 if(lookup)parts.push(key(10),Buffer.from([2,0,1,0]))
 if(opts.extra)parts.push(Buffer.from(opts.extra))
 return Buffer.concat(parts).toString('base64')
}
const unsigned=message()
const original={
 executionId:'execution:signer',tradeId:'trade:signer',requestId:'req:signer',
 runLineageId:'lineage:signer',userId:'owner:1',strategyId:'sniper-canary',
 instrumentId:'solana:'+inputMint,leg:'ENTRY' as const,provider:'jupiter-ultra' as const,
 walletConnectionId:'coffer:1',signerLeaseId:'lease:1',inputMint,outputMint,
 inputAmountAtomic:1000n,minimumOutputAtomic:900n,notionalMinor:1000n,
 currency:'LAMPORTS',idempotencyKey:'idempotency:signer:1',
 informationCutoff:'2026-10-23T12:00:00.450Z',
}
const approval={
 sharkAssessmentId:'assessment:1',thesisId:'thesis:1',edgeDecisionBundleHash:'edge:1',
 integrityGuardHash:'integrity:1',moneyRiskDecisionId:'money:approve',
 intentFingerprint:hashDexRuntime({...original,inputAmountAtomic:'1000',
  minimumOutputAtomic:'900',notionalMinor:'1000'}),
 approvedAt:'2026-10-23T12:00:00.470Z',
 authority:'MONEY_RISK_APPROVAL_BINDING' as const,
}
const intent:DexSwapIntent={...original,
 approval:{...approval,bindingHash:hashDexRuntime(approval)},
 evidenceIds:['chain:verified','Money:policy'],authority:'MONEY_EXECUTION_INTENT',
}
const order:DexManagedOrder={provider:'jupiter-ultra',requestId:'jupiter:signer',
 inputMint,outputMint,inputAmountAtomic:1000n,quotedOutputAtomic:1000n,
 unsignedTransactionBase64:unsigned,takerAddress:payer,
 evidenceIds:['quoted:jupiter'],authority:'PROVIDER_QUOTE_ONLY',canBroadcast:false,
}
const alt:SniperAltObservation={
 address:table,ownerProgram:'AddressLookupTab1e1111111111111111111111111',
 contextSlot:200,lastExtendedSlot:150,deactivated:false,
 addresses:[inputToken,outputToken],evidenceIds:['rpc:alt:slot200'],
 authority:'TRUSTED_RPC_LOOKUP_OBSERVATION',
}
const canary={
 provider:'jupiter-ultra',accountId:'coffer:1',currency:'LAMPORTS',
 tradingDate:'2026-10-23',submittedNotionalMinor:0n,submittedOrders:0,
 realizedLossMinor:0n,grossExposureMinor:0n,unresolvedExecutionIds:[],
 updatedAt:'2026-10-23T12:00:00.400Z',
 riskMetricEvidenceIds:['risk:evidence'],halted:false,version:1,
}
const signer={
 leaseId:'lease:1',spent24hMinor:0n,transactionCount24h:0,
 observedAt:'2026-10-23T12:00:00.400Z',evidenceIds:['signer:current'],
 authority:'SIGNER_EVIDENCE' as const,
}
const guard:SniperSignerGuard={
 version:1,observedAt:'2026-10-23T12:00:00.400Z',halted:false,
 unresolvedExecutionIds:[],existingIdempotencyKeys:[],
 canary,signer,solFeeReserveLamports:100000n,
 authority:'TRUSTED_GUARD_READ',
}
const sim:SniperSignerSimulation={
 transactionSha256:sha256UnsignedTransaction(unsigned),contextSlot:200,
 blockhash,err:null,
 tokenAccounts:[
  {address:inputToken,mint:inputMint,owner:payer,beforeAtomic:2000n,afterAtomic:1000n},
  {address:outputToken,mint:outputMint,owner:payer,beforeAtomic:0n,afterAtomic:950n},
 ],
 executedProgramIds:[program],allInnerInstructionsObserved:true,
 baseFeeLamports:5000n,priorityFeeLamports:1000n,
 jitoTipLamports:0n,extraSolDebitLamports:0n,
 evidenceIds:['rpc:simulation:200'],authority:'TRUSTED_UNSIGNED_SIMULATION',
}
const params=()=>({
 intent,order,
 signerLease:{leaseId:'lease:1',walletConnectionId:'coffer:1',agentId:'jhadina',
  sessionId:'session:1',tokenFingerprint:'token:fingerprint',
  issuedAt:'2026-10-23T11:50:00Z',expiresAt:'2026-10-23T12:10:00Z',
  state:'ACTIVE' as const,authority:'LEASE_METADATA_ONLY' as const,
  containsPrivateKey:false as const,containsRawToken:false as const},
 signerPolicy:{walletConnectionId:'coffer:1',agentId:'jhadina',sessionId:'session:1',
  perTransactionCapMinor:10000n,rolling24hCapMinor:50000n,maxTransactionCount:5,
  allowedDestinationAddresses:[payer],allowedAssets:[inputMint,outputMint],
  authority:'OWNER_SIGNER_POLICY' as const},
 canaryPolicy:{policyId:'test:canary',currency:'LAMPORTS',
  maxOrderNotionalMinor:10000n,maxDailySubmittedNotionalMinor:100000n,
  maxDailyOrders:10,maxDailyRealizedLossMinor:10000n,
  maxGrossExposureMinor:20000n,maxOpenUnknownExecutions:0,
  maxRiskMetricAgeSeconds:3,authority:'RISK_POLICY_ONLY' as const},
 policy:{ownerWalletAddress:addr(1),cofferAddress:payer,
  inputTokenAccount:inputToken,outputTokenAccount:outputToken,
  allowedPrograms:[program],minContextSlot:199,maxEvidenceAgeMs:3000,
  maxFeeLamports:8000n,minSolReserveLamports:90000n,
  authority:'SIGNER_SEMANTIC_REVIEW_POLICY' as const},
 host:{
  now:()=>at,
  readLookupTable:async()=>alt,
  readGuard:async()=>guard,
  simulateUnsigned:async()=>sim,
 },
})
test('reads actual v0 ALT address order, maps writable token accounts and fee payer',async()=>{
 const r=await decodeSignerMessage({
  unsignedTransactionBase64:unsigned,expectedFeePayer:payer,
  minContextSlot:199,rpc:{readLookupTable:async()=>alt},
 })
 assert.equal(r.format,'V0')
 assert.deepEqual(r.lookupTableAddresses,[table])
 assert.deepEqual(r.accounts,[payer,program,inputToken,outputToken])
 assert.deepEqual(r.writableAccounts,[payer,inputToken,outputToken])
 assert.deepEqual(r.instructions[0]?.accounts,[payer,inputToken,outputToken])
 assert.equal(r.canSign,false)
})
test('simulation and guard research can match but can NEVER sign, credit or submit',async()=>{
 const r=await certifySniperSignerCandidate(params())
 assert.equal(r.disposition,'RESEARCH_OBSERVATION_MATCHED',r.reasonCodes.join(','))
 assert.equal(r.transactionSha256,sha256UnsignedTransaction(unsigned))
 assert.equal(r.simulatedOutputAtomic,950n)
 assert.equal(r.simulatedFeesLamports,6000n)
 assert.equal(r.canSign,false);assert.equal(r.canSubmit,false)
 assert.equal(r.canCreditPurse,false);assert.equal(r.canRetry,false)
})
test('untrusted ALT, deactivation, last-extension and wrong index are blocked',async()=>{
 for(const proof of [
  {...alt,ownerProgram:addr(9)},
  {...alt,deactivated:true},
  {...alt,lastExtendedSlot:200},
  {...alt,addresses:[inputToken]},
  {...alt,contextSlot:198},
 ]){
  await assert.rejects(decodeSignerMessage({
   unsignedTransactionBase64:unsigned,expectedFeePayer:payer,minContextSlot:199,
   rpc:{readLookupTable:async()=>proof},
  }),/SIGNER_ALT_/)
 }
})
test('rejects v1, pre-signed wire, unexpected program index and stale chain context',async()=>{
 for(const wire of [message({version:0x81}),message({signatureValue:7}),
  message({programIx:0}),message({extra:[42]})]){
  await assert.rejects(decodeSignerMessage({
   unsignedTransactionBase64:wire,expectedFeePayer:payer,minContextSlot:199,
   rpc:{readLookupTable:async()=>alt},
  }))
 }
})
test('failing token simulation and hidden CPI are vetoed even when the quote is favorable',async()=>{
 for(const bad of [
  {...sim,tokenAccounts:[sim.tokenAccounts[0]!,{...sim.tokenAccounts[1]!,
    mint:addr(22)}]},
  {...sim,tokenAccounts:[sim.tokenAccounts[0]!,{...sim.tokenAccounts[1]!,
    owner:addr(25)}]},
  {...sim,tokenAccounts:[{...sim.tokenAccounts[0]!,afterAtomic:1500n},sim.tokenAccounts[1]!] },
  {...sim,allInnerInstructionsObserved:false},
  {...sim,executedProgramIds:[program,addr(22)]},
  {...sim,extraSolDebitLamports:3000n},
  {...sim,priorityFeeLamports:10000n},
  {...sim,contextSlot:10},
 ]){
  const p=params()
  const r=await certifySniperSignerCandidate({
   ...p,host:{...p.host,simulateUnsigned:async()=>bad},
  })
  assert.equal(r.disposition,'BLOCKED',r.reasonCodes.join(','))
  assert.equal(r.canSign,false)
 }
})
test('re-check kill switch and unknown order after async simulation, never duplicate sell',async()=>{
 for(const second of [
  {...guard,halted:true,version:2},
  {...guard,version:2,unresolvedExecutionIds:['sell:unknown']},
  {...guard,existingIdempotencyKeys:[intent.idempotencyKey]},
 ]){
  const p=params()
  let calls=0
  const r=await certifySniperSignerCandidate({...p,host:{
   ...p.host,readGuard:async()=>++calls===1?guard:second,
  }})
  assert.equal(r.disposition,'BLOCKED')
  assert.ok(r.reasonCodes.includes('GUARD_CHANGED_OR_UNVERIFIED_AFTER_SIMULATION'))
  assert.equal(r.canRetry,false)
 }
})
test('preexisting unknown attempt, revoked lease and daily-loss stop veto before simulation',async()=>{
 const scenarios=[
  {...guard,unresolvedExecutionIds:['sell:unknown']},
  {...guard,existingIdempotencyKeys:[intent.idempotencyKey]},
  {...guard,canary:{...canary,halted:true}},
  {...guard,canary:{...canary,realizedLossMinor:10000n}},
 ]
 for(const state of scenarios){
  const p=params()
  let called=0
  const r=await certifySniperSignerCandidate({...p,host:{
   ...p.host,readGuard:async()=>state,
   simulateUnsigned:async()=>{called++;return sim},
  }})
  assert.equal(r.disposition,'BLOCKED')
  assert.equal(called,0)
 }
 const p=params()
 const denied=await certifySniperSignerCandidate({...p,signerLease:{
  ...p.signerLease,state:'REVOKED',
 }})
 assert.equal(denied.disposition,'BLOCKED')
 assert.ok(denied.reasonCodes.includes('SIGNER_POLICY_OR_LEASE_BLOCKED'))
})
