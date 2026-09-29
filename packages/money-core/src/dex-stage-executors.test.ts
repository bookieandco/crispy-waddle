import { describe,it } from 'node:test'
import assert from 'node:assert/strict'
import { RecordedMarketDexStageExecutor,SignedNoBroadcastDexStageExecutor,type RecordedMarketStageSource } from './dex-stage-executors.js'
import { createSharkPreExecutionBinding,type SharkPreExecutionMaterial } from './shark-preexec-binding.js'
import { createApprovedDexSwapIntent,type CofferSignerAdapter,type DexManagedOrder,type DexSignedTransaction,type ManagedSolanaDexAdapter,type SolanaChainObserver,type DexSimulationReceipt,type DexUnsignedSimulationReceipt,type DexOnchainReceipt } from './solana-dex-runtime-contracts.js'
import type { ConnectedWallet } from './wallet-connector-contracts.js'
import type { MoneyMarketConnectorDescriptor } from './market-connector-contracts.js'
import type { SignerLease,SignerLeasePolicy,SignerRollingObservation } from './signer-lease-contracts.js'
import type { EdgeDecisionBundleReceipt,Edge007IntegrityReceipt } from './dex-four-stage-certification.js'

const edge:EdgeDecisionBundleReceipt={
 frameworkVersion:'EDGE-001-006-v1',
 receipts:(['EDGE-001','EDGE-002','EDGE-003','EDGE-004','EDGE-005','EDGE-006'] as const).map(gateId=>({gateId,version:'EDGE-001-006-v1',disposition:'PASS',reasonCodes:[],evidenceIds:['e:'+gateId],evaluatedAt:'2026-09-28T01:00:00Z',authority:'RESEARCH_AND_RISK_GATE_ONLY',canAuthorizeTrade:false})),
 disposition:'PASS',reasonCodes:[],evidenceIds:['edge:e'],authority:'RESEARCH_AND_RISK_GATE_ONLY',canAuthorizeTrade:false,
}
const integrity:Edge007IntegrityReceipt={guardVersion:'EDGE-007-v1',guardId:'edge7',disposition:'PASS',reasonCodes:[],evidenceIds:['edge7:e'],authority:'INTEGRITY_VETO_ONLY',canAuthorizeTrade:false,canAuthorizePromotion:false}
const material:SharkPreExecutionMaterial={assessmentId:'assessment:1',assessment:{token:'TOKEN',score:0.8},assessmentEvidenceIds:['assessment:e'],edgeDecisionBundle:edge,integrityGuard:integrity}
const cutoff='2026-09-28T01:00:00Z'
const preExecution=createSharkPreExecutionBinding({material,informationCutoff:cutoff})
const wallet:ConnectedWallet={connectionId:'coffer:1',userId:'u1',provider:'coffer',network:'SOLANA',address:'Wallet111',mode:'COFFER_EXECUTION_WALLET',connectedAt:'2026-09-28T00:00:00Z',evidenceIds:['wallet:e'],authority:'CONNECTION_ONLY',canSign:false}
const connector:MoneyMarketConnectorDescriptor={connectorId:'dex:jup',provider:'jupiter-ultra',lane:'DEX',admission:'CONTROLLED_CANARY',readCapabilities:['quote'],executionCapabilities:['swap'],credentialRef:'secret://jupiter',evidenceIds:['connector:e'],authority:'CONNECTOR_METADATA_ONLY'}
const signerPolicy:SignerLeasePolicy={walletConnectionId:wallet.connectionId,agentId:'money',sessionId:'sim',perTransactionCapMinor:1000n,rolling24hCapMinor:2000n,maxTransactionCount:2,allowedDestinationAddresses:[wallet.address],allowedAssets:['USDC','TOKEN'],authority:'OWNER_SIGNER_POLICY'}
const signerLease:SignerLease={leaseId:'lease:1',walletConnectionId:wallet.connectionId,agentId:'money',sessionId:'sim',tokenFingerprint:'fp',issuedAt:'2026-09-28T00:00:00Z',expiresAt:'2026-09-28T03:00:00Z',state:'ACTIVE',authority:'LEASE_METADATA_ONLY',containsPrivateKey:false,containsRawToken:false}
const signerObservation:SignerRollingObservation={leaseId:signerLease.leaseId,spent24hMinor:0n,transactionCount24h:0,observedAt:'2026-09-28T01:00:00Z',evidenceIds:['signer-history:e'],authority:'SIGNER_EVIDENCE'}
const boundary={connector,wallet,signerPolicy,signerLease,signerObservation}

const intent=createApprovedDexSwapIntent({
 draft:{
  executionId:'exec:sim',tradeId:'trade:1',requestId:'req:sim',runLineageId:'lineage:1',userId:'u1',strategyId:'meme',instrumentId:'solana:TOKEN',leg:'ENTRY',
  provider:'jupiter-ultra',routePreference:'AUTO',requestedSlippageBps:50,walletConnectionId:wallet.connectionId,signerLeaseId:signerLease.leaseId,
  inputMint:'USDC',outputMint:'TOKEN',inputAmountAtomic:1000n,minimumOutputAtomic:900n,notionalMinor:100n,currency:'USD',idempotencyKey:'idem:sim',informationCutoff:cutoff,preExecution,evidenceIds:['intent:e'],
 },
 governance:{sharkAssessmentId:'assessment:1',thesisId:'thesis:1',preExecution,edgeDecisionBundle:edge,integrityGuard:integrity,moneyRisk:{riskDecisionId:'risk:1',disposition:'APPROVE',reasonCodes:[],evidenceIds:['risk:e'],evaluatedAt:'2026-09-28T01:00:01Z',authority:'MONEY_RISK_DECISION',canExecute:false},approvedAt:'2026-09-28T01:00:02Z'},
})

describe('DEX stage executors',()=>{
 it('constructs real replay and shadow evidence from recorded-market decision batches',async()=>{
  const source:RecordedMarketStageSource={load:async({stage})=>({stage,startedAt:stage==='HISTORICAL_REPLAY'?'2026-09-28T00:00:00Z':'2026-09-28T00:10:00Z',endedAt:stage==='HISTORICAL_REPLAY'?'2026-09-28T00:05:00Z':'2026-09-28T00:15:00Z',informationCutoff:stage==='HISTORICAL_REPLAY'?'2026-09-28T00:05:00Z':'2026-09-28T00:15:00Z',decisionIds:['d1'],futureEvidenceCount:0,edgeDecisionBundle:edge,integrityGuard:integrity,evidenceIds:['market:'+stage],source:'RECORDED_REAL_MARKET'})}
  const replay=await new RecordedMarketDexStageExecutor('HISTORICAL_REPLAY',source).run({priorStages:[],runLineageId:'lineage:1',strategyId:'meme',instrumentId:'solana:TOKEN'})
  const shadow=await new RecordedMarketDexStageExecutor('LIVE_SHADOW',source).run({priorStages:[replay.evidence],runLineageId:'lineage:1',strategyId:'meme',instrumentId:'solana:TOKEN'})
  assert.equal(replay.runClass,'REAL_RUNTIME')
  assert.equal(shadow.evidence.broadcastCount,0)
  assert.equal(shadow.evidence.signedTransactionCount,0)
 })
 it('signs and simulates through the isolated Coffer but never reaches provider execution',async()=>{
  let executeCalls=0,signCalls=0,unsignedCalls=0,signedCalls=0
  const adapter:ManagedSolanaDexAdapter={
   provider:'jupiter-ultra',
   createOrder:async()=>({provider:'jupiter-ultra',requestId:'q1',inputMint:'USDC',outputMint:'TOKEN',inputAmountAtomic:1000n,quotedOutputAtomic:1000n,unsignedTransactionBase64:'unsigned',takerAddress:wallet.address,quoteObservedAt:'2026-09-28T01:00:03Z',priceImpactBps:10,evidenceIds:['quote:e'],authority:'PROVIDER_QUOTE_ONLY',canBroadcast:false} satisfies DexManagedOrder),
   executeSigned:async()=>{executeCalls++;throw new Error('BROADCAST_MUST_NOT_BE_REACHED')},
  }
  const signer:CofferSignerAdapter={provider:'coffer',signVersionedTransaction:async i=>{signCalls++;return {signerProvider:'coffer',walletConnectionId:i.walletConnectionId,signerLeaseId:i.signerLeaseId,signerAddress:i.expectedSignerAddress,primarySignature:'sig1',signedTransactionBase64:'signed',signedTransactionHash:'hash1',evidenceIds:['signed:e'],authority:'SIGNER_OUTPUT_ONLY',containsPrivateKey:false,containsRawToken:false} satisfies DexSignedTransaction}}
  const chain:SolanaChainObserver={
   simulateUnsignedTransaction:async i=>{unsignedCalls++;return {simulationId:'preflight',passed:true,logs:[],observedAt:i.now,evidenceIds:['preflight:e'],authority:'CHAIN_PREFLIGHT_EVIDENCE'} satisfies DexUnsignedSimulationReceipt},
   simulateSignedTransaction:async i=>{signedCalls++;return {simulationId:'signed-sim',signature:i.primarySignature,passed:true,feeLamports:5000n,logs:[],observedAt:i.now,evidenceIds:['signed-sim:e'],authority:'CHAIN_SIMULATION_EVIDENCE'} satisfies DexSimulationReceipt},
   observeSwap:async()=>({} as DexOnchainReceipt),
  }
  let tick=3
  const executor=new SignedNoBroadcastDexStageExecutor({
   intent,preExecutionMaterial:material,boundary,adapter,signer,chain,
   dexGatePolicy:{maxQuoteAgeMs:5000,maxSlippageBps:100,maxPriceImpactBps:100,minSolFeeReserveLamports:100n,maxConsecutiveLosses:3},
   loadDexGateContext:({now})=>({now,walletSolBalanceLamports:1_000_000n,estimatedFeeLamports:5000n,solSpendLamports:0n,consecutiveLosses:0,admission:{inputMint:'USDC',outputMint:'TOKEN',inputTokenAdmitted:true,outputTokenAdmitted:true,contractAdmitted:true,evidenceIds:['admission:e'],authority:'TOKEN_CONTRACT_ADMISSION_ONLY',canAuthorizeTrade:false},evidenceIds:['gate-context:e']}),
   now:()=>`2026-09-28T01:00:0${tick++}Z`,
  })
  const result=await executor.run({priorStages:[],runLineageId:'lineage:1',strategyId:'meme',instrumentId:'solana:TOKEN'})
  assert.equal(result.evidence.stage,'SIGNED_SIMULATION_NO_BROADCAST')
  assert.equal(result.evidence.signedTransactionCount,1)
  assert.equal(result.evidence.simulationCount,2)
  assert.equal(result.evidence.broadcastCount,0)
  assert.deepEqual(result.evidence.providerReceiptIds,[])
  assert.equal(signCalls,1)
  assert.equal(unsignedCalls,1)
  assert.equal(signedCalls,1)
  assert.equal(executeCalls,0)
 })
})
