import test from 'node:test'
import assert from 'node:assert/strict'
import type { PermitStore,ExecutionPermit } from './execution-permit.js'
import { issueExecutionPermit } from './execution-permit.js'
import { InMemoryLiveCanaryStateStore } from './live-canary-store.js'
import type { LiveCanaryPolicy } from './live-canary-contracts.js'
import type { ConnectedWallet } from './wallet-connector-contracts.js'
import type { MoneyMarketConnectorDescriptor } from './market-connector-contracts.js'
import type { SignerLease,SignerLeasePolicy,SignerRollingObservation } from './signer-lease-contracts.js'
import type { CofferSignerAdapter,DexManagedOrder,DexProviderExecutionReceipt,DexSignedTransaction,DexSwapIntent,ManagedSolanaDexAdapter,SolanaChainObserver,DexSimulationReceipt,DexOnchainReceipt } from './solana-dex-runtime-contracts.js'
import { InMemoryDexExecutionAttemptStore } from './solana-dex-runtime-contracts.js'
import { dexExecutionAction,proveDexRestartRecovery,reconcileDexCanaryLeg,submitControlledDexCanaryLeg } from './dex-controlled-canary-runtime.js'
import { buildDexControlledLiveCanaryEvidence,certifyDexCommissionFinal,createDexLiveRuntimeVerificationReceipt,proveDexCapitalBoundary,proveDexKillSwitch } from './dex-commission-final.js'
import { certifyDexExecutionLadder,type DexExecutionStageEvidence,type EdgeDecisionBundleReceipt,type Edge007IntegrityReceipt } from './dex-four-stage-certification.js'
import { createSharkPreExecutionBinding,type SharkPreExecutionMaterial } from './shark-preexec-binding.js'
import type { MoneyDexGateContext,MoneyDexGatePolicy } from './money-dex-gate.js'
import { JupiterUltraDexAdapter } from './jupiter-ultra-dex-adapter.js'
import { RemoteCofferSignerAdapter } from './remote-coffer-signer-adapter.js'
import { SolanaRpcHttpObserver } from './solana-rpc-http-observer.js'
import { DurableEventBus,InMemoryEventJournal,TradeMemory,type RuntimeEventContext } from '@jhadina/event-bus'

const settlement='USDC_MINT'
const target='TARGET_MINT'
const wallet:ConnectedWallet={connectionId:'wallet:coffer:1',userId:'u1',provider:'coffer-signer',network:'SOLANA',address:'Wallet111',mode:'COFFER_EXECUTION_WALLET',connectedAt:'2026-09-27T20:00:00Z',evidenceIds:['wallet:e'],authority:'CONNECTION_ONLY',canSign:false}
const connector:MoneyMarketConnectorDescriptor={connectorId:'dex:router:canary',provider:'solana-dex-router',lane:'DEX',admission:'CONTROLLED_CANARY',readCapabilities:['quote','status','route'],executionCapabilities:['swap'],credentialRef:'secret://dex/router',evidenceIds:['connector:e'],authority:'CONNECTOR_METADATA_ONLY'}
const signerPolicy:SignerLeasePolicy={walletConnectionId:wallet.connectionId,agentId:'money',sessionId:'dex-canary',perTransactionCapMinor:1000n,rolling24hCapMinor:2000n,maxTransactionCount:2,allowedDestinationAddresses:[wallet.address],allowedAssets:[settlement,target],authority:'OWNER_SIGNER_POLICY'}
const signerLease:SignerLease={leaseId:'lease:1',walletConnectionId:wallet.connectionId,agentId:'money',sessionId:'dex-canary',tokenFingerprint:'sha256:lease',issuedAt:'2026-09-27T20:00:00Z',expiresAt:'2026-09-27T22:00:00Z',state:'ACTIVE',authority:'LEASE_METADATA_ONLY',containsPrivateKey:false,containsRawToken:false}
const signerObservation:SignerRollingObservation={leaseId:signerLease.leaseId,spent24hMinor:0n,transactionCount24h:0,observedAt:'2026-09-27T20:30:00Z',evidenceIds:['signer:history'],authority:'SIGNER_EVIDENCE'}
const boundary={connector,wallet,signerPolicy,signerLease,signerObservation}
const canaryPolicy:LiveCanaryPolicy={policyId:'dex-canary',currency:'USD',maxOrderNotionalMinor:1000n,maxDailySubmittedNotionalMinor:2000n,maxDailyOrders:2,maxDailyRealizedLossMinor:500n,maxGrossExposureMinor:1000n,maxOpenUnknownExecutions:0,maxRiskMetricAgeSeconds:3600,authority:'RISK_POLICY_ONLY'}
const dexGatePolicy:MoneyDexGatePolicy={maxQuoteAgeMs:10*60*1000,maxSlippageBps:100,maxPriceImpactBps:100,minSolFeeReserveLamports:100000n,maxConsecutiveLosses:3}

const edgeDecisionBundle:EdgeDecisionBundleReceipt={
 frameworkVersion:'EDGE-001-006-v1',
 receipts:(['EDGE-001','EDGE-002','EDGE-003','EDGE-004','EDGE-005','EDGE-006'] as const).map(gateId=>({
  gateId,version:'EDGE-001-006-v1',disposition:'PASS' as const,reasonCodes:[],evidenceIds:[gateId+':e'],evaluatedAt:'2026-09-27T18:58:00Z',authority:'RESEARCH_AND_RISK_GATE_ONLY' as const,canAuthorizeTrade:false as const
 })),
 disposition:'PASS',reasonCodes:[],evidenceIds:['edge:bundle:e'],authority:'RESEARCH_AND_RISK_GATE_ONLY',canAuthorizeTrade:false
}
const integrity:Edge007IntegrityReceipt={guardVersion:'EDGE-007-v1',guardId:'edge:1',disposition:'PASS',reasonCodes:[],evidenceIds:['edge:e'],authority:'INTEGRITY_VETO_ONLY',canAuthorizeTrade:false,canAuthorizePromotion:false}
const preExecutionMaterial:SharkPreExecutionMaterial={
 assessmentId:'assessment:target:1',
 assessment:{assessmentId:'assessment:target:1',token:{chainId:'solana-mainnet',tokenAddress:target},confidence:.77,riskAssessment:{band:'candidate'},thesis:'bounded canary candidate'},
 assessmentEvidenceIds:['assessment:e'],
 edgeDecisionBundle,
 integrityGuard:integrity,
}
const preExecution=createSharkPreExecutionBinding({material:preExecutionMaterial,informationCutoff:'2026-09-27T20:30:00Z',evidenceIds:['money:intent:e']})

const tradeId='trade:target:1'
const tradeEventContext:RuntimeEventContext={workSessionId:'ws:trade:1',taskId:'task:trade:1',correlationId:tradeId,actorId:'money',domain:'trading',capability:'money.trade.lifecycle',authorityRef:'money:controlled-canary',idempotencyKey:'base'}

async function seedTradeToOrderIntent(memory:TradeMemory):Promise<void>{
 const early=[
  ['TOKEN_DISCOVERED','token:'+target],
  ['SHARK_ANALYZED',preExecutionMaterial.assessmentId],
  ['THESIS_CREATED','thesis:target:1'],
  ['RISK_APPROVED',preExecution.edgeDecisionBundleHash],
  ['ORDER_INTENT_CREATED',preExecution.bindingHash],
 ] as const
 for(let i=0;i<early.length;i++){
  const [type,referenceId]=early[i]!
  await memory.record({
   id:'trade:seed:'+(i+1),type,occurredAt:new Date(Date.UTC(2026,8,27,20,20,i)).toISOString(),
   context:{...tradeEventContext,idempotencyKey:'trade:seed:'+(i+1)},tradeId,runLineageId:'lineage:1',userId:'u1',strategyId:'shark:meme:v1',instrumentId:'solana:TARGET',
   referenceId,evidenceIds:['trade:seed:'+type],
  })
 }
}

class PermitMemory implements PermitStore{
 rows=new Map<string,ExecutionPermit>()
 issue(p:ExecutionPermit){this.rows.set(p.permitId,p)}
 get(id:string){return this.rows.get(id)}
 consume(id:string,nonce:string){const p=this.rows.get(id);if(!p||p.nonce!==nonce||p.state!=='ISSUED')return false;this.rows.set(id,{...p,state:'CONSUMED'});return true}
 revoke(id:string){const p=this.rows.get(id);if(p)this.rows.set(id,{...p,state:'REVOKED'})}
 haltAll(){for(const [id,p] of this.rows)if(p.state==='ISSUED')this.rows.set(id,{...p,state:'HALTED'})}
}

const intent=(leg:'ENTRY'|'EXIT'):DexSwapIntent=>({
 executionId:'exec:'+leg.toLowerCase(),requestId:'req:'+leg.toLowerCase(),runLineageId:'lineage:1',userId:'u1',strategyId:'shark:meme:v1',instrumentId:'solana:TARGET',
 leg,provider:'solana-dex-router',routePreference:'AUTO',requestedSlippageBps:50,walletConnectionId:wallet.connectionId,signerLeaseId:signerLease.leaseId,
 inputMint:leg==='ENTRY'?settlement:target,outputMint:leg==='ENTRY'?target:settlement,
 inputAmountAtomic:leg==='ENTRY'?1000000n:500000n,minimumOutputAtomic:leg==='ENTRY'?500000n:990000n,notionalMinor:1000n,currency:'USD',idempotencyKey:'idem:'+leg.toLowerCase(),
 informationCutoff:'2026-09-27T20:30:00Z',evidenceIds:['shark:'+leg],preExecution,authority:'MONEY_EXECUTION_INTENT'
})

const dexGateContext=(now:string,i:DexSwapIntent):MoneyDexGateContext=>({
 now,walletSolBalanceLamports:2_000_000n,estimatedFeeLamports:5000n,solSpendLamports:i.inputMint==='So11111111111111111111111111111111111111112'?i.inputAmountAtomic:0n,
 consecutiveLosses:0,
 admission:{inputMint:i.inputMint,outputMint:i.outputMint,inputTokenAdmitted:true,outputTokenAdmitted:true,contractAdmitted:true,evidenceIds:['token-admission:'+i.leg],authority:'TOKEN_CONTRACT_ADMISSION_ONLY',canAuthorizeTrade:false},
 evidenceIds:['wallet-sol-balance:e','loss-ledger:e'],
})

class FakeSigner implements CofferSignerAdapter{
 readonly provider='fake-signer'
 calls=0
 async signVersionedTransaction(i:{walletConnectionId:string;signerLeaseId:string;unsignedTransactionBase64:string;idempotencyKey:string;expectedSignerAddress:string;now:string}):Promise<DexSignedTransaction>{
  this.calls++
  const sig='sig:'+i.idempotencyKey
  return {signerProvider:this.provider,walletConnectionId:i.walletConnectionId,signerLeaseId:i.signerLeaseId,signerAddress:i.expectedSignerAddress,primarySignature:sig,signedTransactionBase64:'signed:'+i.unsignedTransactionBase64,signedTransactionHash:'hash:'+sig,evidenceIds:['signer:'+sig],authority:'SIGNER_OUTPUT_ONLY',containsPrivateKey:false,containsRawToken:false}
 }
}
class FakeDex implements ManagedSolanaDexAdapter{
 readonly provider='solana-dex-router' as const
 calls=0
 async createOrder({intent:i,takerAddress}:{intent:DexSwapIntent;takerAddress:string}):Promise<DexManagedOrder>{
  return {provider:'jupiter-ultra',requestId:'jup:'+i.executionId,inputMint:i.inputMint,outputMint:i.outputMint,inputAmountAtomic:i.inputAmountAtomic,quotedOutputAtomic:i.minimumOutputAtomic+100n,unsignedTransactionBase64:'unsigned:'+i.executionId,takerAddress,quoteObservedAt:'2026-09-27T20:29:59Z',priceImpactBps:10,evidenceIds:['jup:order'],authority:'PROVIDER_QUOTE_ONLY',canBroadcast:false}
 }
 async executeSigned({intent:i,order,signed,now}:{intent:DexSwapIntent;order:DexManagedOrder;signed:DexSignedTransaction;now:string}):Promise<DexProviderExecutionReceipt>{
  this.calls++
  return {receiptId:'receipt:'+i.executionId,provider:order.provider,requestId:order.requestId,executionId:i.executionId,state:'ACKNOWLEDGED',signature:signed.primarySignature,inputAmountAtomic:i.inputAmountAtomic,outputAmountAtomic:i.minimumOutputAtomic+100n,observedAt:now,evidenceIds:['provider:'+i.executionId],authority:'PROVIDER_EXECUTION_EVIDENCE'}
 }
}
class FakeChain implements SolanaChainObserver{
 async simulateUnsignedTransaction(i:{unsignedTransactionBase64:string;now:string}):Promise<DexSimulationReceipt>{
  return {simulationId:'sim:unsigned',simulationMode:'UNSIGNED_PRE_SIGN',passed:true,unitsConsumed:123,feeLamports:5000n,logs:[],observedAt:i.now,evidenceIds:['sim:unsigned:e'],authority:'CHAIN_SIMULATION_EVIDENCE'}
 }
 async simulateSignedTransaction(i:{signedTransactionBase64:string;primarySignature:string;now:string}):Promise<DexSimulationReceipt>{
  return {simulationId:'sim:'+i.primarySignature,simulationMode:'SIGNED_NO_BROADCAST',signature:i.primarySignature,passed:true,unitsConsumed:123,feeLamports:5000n,logs:[],observedAt:i.now,evidenceIds:['sim:signed:e'],authority:'CHAIN_SIMULATION_EVIDENCE'}
 }
 async observeSwap(i:{signature:string;walletAddress:string;inputMint:string;outputMint:string;now:string}):Promise<DexOnchainReceipt>{
  const isEntry=i.inputMint===settlement
  return {signature:i.signature,found:true,confirmed:true,failed:false,slot:123,feeLamports:5000n,inputDebitAtomic:isEntry?1000000n:500000n,outputCreditAtomic:isEntry?500100n:990100n,inputPostBalanceAtomic:0n,outputPostBalanceAtomic:isEntry?500100n:990100n,observedAt:i.now,evidenceIds:['chain:'+i.signature],authority:'ONCHAIN_EVIDENCE'}
 }
}
function stage(stage:DexExecutionStageEvidence['stage']):DexExecutionStageEvidence{
 const times:{[K in DexExecutionStageEvidence['stage']]:readonly [string,string]}={
  HISTORICAL_REPLAY:['2026-09-27T19:00:00Z','2026-09-27T19:05:00Z'],
  LIVE_SHADOW:['2026-09-27T19:06:00Z','2026-09-27T19:11:00Z'],
  SIGNED_SIMULATION_NO_BROADCAST:['2026-09-27T19:12:00Z','2026-09-27T19:17:00Z'],
  CONTROLLED_LIVE_CANARY:['2026-09-27T20:30:00Z','2026-09-27T21:00:00Z'],
 }
 const [startedAt,endedAt]=times[stage]
 return {stageId:'stage:'+stage,stage,origin:stage==='SIGNED_SIMULATION_NO_BROADCAST'?'LIVE_RUNTIME_ATTESTED':'RECORDED_REAL_MARKET',runLineageId:'lineage:1',strategyId:'shark:meme:v1',instrumentId:'solana:TARGET',
  walletConnectionId:stage==='SIGNED_SIMULATION_NO_BROADCAST'?wallet.connectionId:undefined,startedAt,endedAt,informationCutoff:endedAt,edgeDecisionBundle,integrityGuard:integrity,decisionCount:1,signedTransactionCount:stage==='SIGNED_SIMULATION_NO_BROADCAST'?1:0,simulationCount:stage==='SIGNED_SIMULATION_NO_BROADCAST'?1:0,simulationFailureCount:0,broadcastCount:0,entryBroadcastCount:0,exitBroadcastCount:0,reconciledBroadcastCount:0,duplicateBroadcastCount:0,unknownExecutionCount:0,futureEvidenceCount:0,signerBoundary:stage==='SIGNED_SIMULATION_NO_BROADCAST'?'ISOLATED':'NOT_APPLICABLE',privateKeyMaterialObserved:false,capitalBounded:false,killSwitchProven:false,restartRecoveryProven:false,sellabilityProven:false,positionFlatAfterExit:false,executionCostReconciled:false,providerReceiptIds:[],onchainSignatureIds:[],evidenceIds:['stage:e']}
}

test('reference is adapted to current Jupiter managed endpoints rather than legacy V6 browser flow',async()=>{
 let orderUrl='',executeBody='',apiKey=''
 const adapter=new JupiterUltraDexAdapter({now:()=> '2026-09-27T20:29:59Z',resolveApiKey:()=> 'key-1',fetchFn:async(input,init)=>{
  const url=String(input);if((init?.method??'GET')==='GET'){orderUrl=url;apiKey=(init?.headers as Record<string,string>)['x-api-key'];return new Response(JSON.stringify({requestId:'r1',transaction:'dHg=',inAmount:'1000000',outAmount:'500100',priceImpactPct:'0.10'}),{status:200})}
  executeBody=String(init?.body??'');return new Response(JSON.stringify({status:'Success',signature:'sig:idem:entry',inputAmountResult:'1000000',outputAmountResult:'500100'}),{status:200})
 }})
 const i=intent('ENTRY'),o=await adapter.createOrder({intent:i,takerAddress:wallet.address})
 assert.match(orderUrl,/https:\/\/api\.jup\.ag\/ultra\/v1\/order/)
 assert.doesNotMatch(orderUrl,/quote-api\.jup\.ag/)
 assert.equal(apiKey,'key-1')
 assert.equal(o.priceImpactBps,10)
 await adapter.executeSigned({intent:i,order:o,signed:await new FakeSigner().signVersionedTransaction({walletConnectionId:wallet.connectionId,signerLeaseId:signerLease.leaseId,unsignedTransactionBase64:o.unsignedTransactionBase64,idempotencyKey:i.idempotencyKey,expectedSignerAddress:wallet.address,now:'2026-09-27T20:30:00Z'}),now:'2026-09-27T20:30:00Z'})
 assert.match(executeBody,/"requestId":"r1"/)
 assert.doesNotMatch(executeBody,/privateKey|seed|mnemonic/)
})

test('remote Coffer signer is HTTPS-only and never accepts key material in Money contracts',async()=>{
 assert.throws(()=>new RemoteCofferSignerAdapter({baseUrl:'http://signer.local'}),/HTTPS_REQUIRED/)
 let body=''
 const signer=new RemoteCofferSignerAdapter({baseUrl:'https://signer.local',resolveAuthorizationHeader:()=> 'Bearer opaque',fetchFn:async(_input,init)=>{body=String(init?.body??'');return new Response(JSON.stringify({signerAddress:wallet.address,signedTransactionBase64:'c2lnbmVk',primarySignature:'sig1',evidenceId:'signer:e',containsPrivateKey:false,containsRawToken:false}),{status:200})}})
 const signed=await signer.signVersionedTransaction({walletConnectionId:wallet.connectionId,signerLeaseId:signerLease.leaseId,unsignedTransactionBase64:'dW5zaWduZWQ=',idempotencyKey:'idem',expectedSignerAddress:wallet.address,now:'2026-09-27T20:30:00Z'})
 assert.equal(signed.containsPrivateKey,false);assert.equal(signed.containsRawToken,false)
 assert.doesNotMatch(body,/privateKey|seedPhrase|mnemonic|rawToken/)
})

test('Solana RPC observer preflights and derives token deltas from confirmed chain truth',async()=>{
 let calls=0
 const observer=new SolanaRpcHttpObserver({resolveRpcEndpoint:()=> 'https://rpc.example',fetchFn:async(_input,init)=>{
  calls++;const body=JSON.parse(String(init?.body)) as {method:string}
  if(body.method==='simulateTransaction')return new Response(JSON.stringify({jsonrpc:'2.0',result:{value:{err:null,fee:5000,unitsConsumed:12,logs:[]}}}),{status:200})
  return new Response(JSON.stringify({jsonrpc:'2.0',result:{slot:42,meta:{err:null,fee:5000,preTokenBalances:[{owner:wallet.address,mint:settlement,uiTokenAmount:{amount:'1000000'}},{owner:wallet.address,mint:target,uiTokenAmount:{amount:'0'}}],postTokenBalances:[{owner:wallet.address,mint:settlement,uiTokenAmount:{amount:'0'}},{owner:wallet.address,mint:target,uiTokenAmount:{amount:'500100'}}]}}}),{status:200})
 }})
 const unsigned=await observer.simulateUnsignedTransaction({unsignedTransactionBase64:'abc',now:'2026-09-27T20:29:59Z'})
 const sim=await observer.simulateSignedTransaction({signedTransactionBase64:'abc',primarySignature:'sig',now:'2026-09-27T20:30:00Z'})
 const chain=await observer.observeSwap({signature:'sig',walletAddress:wallet.address,inputMint:settlement,outputMint:target,now:'2026-09-27T20:31:00Z'})
 assert.equal(calls,3);assert.equal(unsigned.simulationMode,'UNSIGNED_PRE_SIGN');assert.equal(sim.simulationMode,'SIGNED_NO_BROADCAST');assert.equal(sim.passed,true);assert.equal(chain.inputDebitAtomic,1000000n);assert.equal(chain.outputCreditAtomic,500100n)
})

test('DEX-COMMISSION.FINAL executes exactly two bounded routed legs, proves restart recovery, flat exit, kill switch, and still forbids unrestricted live',async()=>{
 const adapter=new FakeDex(),signer=new FakeSigner(),chain=new FakeChain(),attempts=new InMemoryDexExecutionAttemptStore(),permits=new PermitMemory(),canary=new InMemoryLiveCanaryStateStore()
 const tradeJournal=new InMemoryEventJournal(),tradeMemory=new TradeMemory(new DurableEventBus(tradeJournal))
 await seedTradeToOrderIntent(tradeMemory)
 await canary.updateRiskMetrics({snapshotId:'risk:1',provider:'solana-dex-router',accountId:wallet.connectionId,currency:'USD',grossExposureMinor:0n,realizedPnlMinor:0n,observedAt:'2026-09-27T20:29:00Z',availableAt:'2026-09-27T20:29:00Z',evidenceIds:['risk:e'],authority:'EVIDENCE_ONLY'},'2026-09-27','2026-09-27T20:30:00Z')
 const run=async(i:DexSwapIntent,attemptId:string,now:string)=>{
  const action=dexExecutionAction(i)
  const p=issueExecutionPermit({action,actionRequestFingerprint:'arf:'+i.leg,authorityId:'authority:'+i.leg,policyVersion:'dex:v1',policyHash:'hash',expiresAt:'2026-09-27T21:30:00Z',now,permitId:'permit:'+i.leg,nonce:'nonce:'+i.leg})
  permits.issue(p)
  return submitControlledDexCanaryLeg({
   intent:i,tradeMemory,tradeId,tradeEventContext,preExecutionMaterial,dexGatePolicy,dexGateContext:dexGateContext(now,i),boundary,adapter,signer,chain,attemptStore:attempts,permitStore:permits,permit:p,
   permitContext:{actionRequestFingerprint:'arf:'+i.leg,authorityId:'authority:'+i.leg,policyVersion:'dex:v1',policyHash:'hash',now},canaryStore:canary,canaryPolicy,tradingDate:'2026-09-27',attemptId,now,
  })
 }
 const entryIntent=intent('ENTRY'),exitIntent=intent('EXIT')
 const entry=await run(entryIntent,'attempt:entry','2026-09-27T20:30:00Z')
 assert.equal(entry.preflight.passed,true)
 assert.equal(entry.attempt.provider,'jupiter-ultra')
 assert.equal(entry.attempt.requestProvider,'solana-dex-router')
 assert.equal(entry.attempt.preExecutionBindingHash,entryIntent.preExecution.bindingHash)
 assert.equal(entry.attempt.moneyDexGateId,entry.preflight.gateId)
 const entryRec=await reconcileDexCanaryLeg({intent:entryIntent,tradeMemory,tradeId,tradeEventContext,boundary,chain,attemptStore:attempts,canaryStore:canary,tradingDate:'2026-09-27',attemptId:'attempt:entry',now:'2026-09-27T20:31:00Z'})
 assert.equal(entryRec.tradeRecord.currentEvent,'FILLED')
 const recovery=await proveDexRestartRecovery({intent:entryIntent,tradeMemory,tradeId,tradeEventContext,boundary,chain,attemptStore:attempts,canaryStore:canary,tradingDate:'2026-09-27',attemptId:'attempt:entry',previousRuntimeId:'runtime:a',recoveryRuntimeId:'runtime:b',now:'2026-09-27T20:32:00Z'})
 await tradeMemory.record({id:'trade:position:1',type:'POSITION_MONITORED',occurredAt:'2026-09-27T20:32:30Z',context:{...tradeEventContext,idempotencyKey:'trade:position:1'},tradeId,runLineageId:'lineage:1',userId:'u1',strategyId:'shark:meme:v1',instrumentId:'solana:TARGET',referenceId:'position:target:1',evidenceIds:['position:e']})
 const exit=await run(exitIntent,'attempt:exit','2026-09-27T20:33:00Z')
 const exitRec=await reconcileDexCanaryLeg({intent:exitIntent,tradeMemory,tradeId,tradeEventContext,boundary,chain,attemptStore:attempts,canaryStore:canary,tradingDate:'2026-09-27',attemptId:'attempt:exit',now:'2026-09-27T20:34:00Z'})
 assert.equal(exitRec.tradeRecord.currentEvent,'EXITED')
 const reviewed=await tradeMemory.record({id:'trade:review:1',type:'TRADE_REVIEWED',occurredAt:'2026-09-27T20:35:00Z',context:{...tradeEventContext,idempotencyKey:'trade:review:1'},tradeId,runLineageId:'lineage:1',userId:'u1',strategyId:'shark:meme:v1',instrumentId:'solana:TARGET',referenceId:'review:target:1',evidenceIds:['review:e']})
 assert.equal(reviewed.completed,true)
 assert.equal(adapter.calls,2);assert.equal(signer.calls,2)
 await assert.rejects(()=>run(entryIntent,'attempt:dup','2026-09-27T20:35:00Z'),/DUPLICATE_EXECUTION_BLOCKED/)
 const capital=proveDexCapitalBoundary({connector,signerPolicy,canaryPolicy,entryIntent,exitIntent,evidenceIds:['capital:e']})
 const kill=await proveDexKillSwitch({canaryStore:canary,permitStore:permits,policy:canaryPolicy,provider:'solana-dex-router',walletConnectionId:wallet.connectionId,tradingDate:'2026-09-27',currency:'USD',now:'2026-09-27T20:36:00Z',evidenceIds:['kill:e']})
 const stage4=buildDexControlledLiveCanaryEvidence({stageId:'stage:canary',strategyId:'shark:meme:v1',instrumentId:'solana:TARGET',edgeDecisionBundle,integrityGuard:integrity,startedAt:'2026-09-27T20:30:00Z',endedAt:'2026-09-27T20:36:00Z',informationCutoff:'2026-09-27T20:36:00Z',entrySubmit:entry,entryReconcile:entryRec,exitSubmit:exit,exitReconcile:exitRec,capitalProof:capital,recoveryProof:recovery,killSwitchProof:kill,tradeRecord:reviewed,evidenceIds:['canary:e']})
 const verification=createDexLiveRuntimeVerificationReceipt({evidence:stage4,entrySubmit:entry,entryReconcile:entryRec,exitSubmit:exit,exitReconcile:exitRec,verifiedAt:'2026-09-27T20:37:00Z'})
 const stages=[stage('HISTORICAL_REPLAY'),stage('LIVE_SHADOW'),stage('SIGNED_SIMULATION_NO_BROADCAST'),stage4]
 const ladder=certifyDexExecutionLadder({stages,liveCanaryVerification:verification})
 assert.equal(ladder.controlledLiveCanaryCertified,true);assert.equal(ladder.unrestrictedLiveAuthorized,false)
 const final=certifyDexCommissionFinal({connector,wallet,signerLease,stages,liveCanaryVerification:verification})
 assert.equal(final.passed,true);assert.equal(final.status,'CONTROLLED_CANARY_CERTIFIED');assert.equal(final.unrestrictedLiveAuthorized,false)
 const noRuntime=certifyDexCommissionFinal({connector,wallet,signerLease,stages})
 assert.equal(noRuntime.passed,false);assert.ok(noRuntime.blockerCodes.includes('DEX_COMMISSION_RUNTIME_CANARY_REQUIRED'))
})
