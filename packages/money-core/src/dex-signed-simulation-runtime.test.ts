import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createApprovedDexSwapIntent,
  InMemoryDexExecutionAttemptStore,
  type CofferSignerAdapter,
  type DexCommissioningBoundary,
  type DexExecutionEventSink,
  type DexManagedOrder,
  type DexProviderExecutionReceipt,
  type DexSignedTransaction,
  type DexSimulationReceipt,
  type DexSwapIntent,
  type DexUnsignedSimulationReceipt,
  type ManagedSolanaDexAdapter,
  type SolanaChainObserver,
} from './solana-dex-runtime-contracts.js'
import type {Edge007IntegrityReceipt,EdgeDecisionBundleReceipt} from './dex-four-stage-certification.js'
import {DEX_SIGNED_SIMULATION_NO_BROADCAST_EVIDENCE,runSignedDexSimulationNoBroadcast} from './dex-signed-simulation-runtime.js'

const edgeDecisionBundle:EdgeDecisionBundleReceipt={
  frameworkVersion:'EDGE-001-006-v1',
  receipts:(['EDGE-001','EDGE-002','EDGE-003','EDGE-004','EDGE-005','EDGE-006'] as const).map(gateId=>({
    gateId,version:'EDGE-001-006-v1',disposition:'PASS',reasonCodes:[],evidenceIds:[gateId+':e'],
    evaluatedAt:'2026-10-03T17:59:00Z',authority:'RESEARCH_AND_RISK_GATE_ONLY',canAuthorizeTrade:false,
  })),
  disposition:'PASS',reasonCodes:[],evidenceIds:['edge:bundle'],authority:'RESEARCH_AND_RISK_GATE_ONLY',canAuthorizeTrade:false,
}
const integrity:Edge007IntegrityReceipt={
  guardVersion:'EDGE-007-v1',guardId:'edge007:1',disposition:'PASS',reasonCodes:[],evidenceIds:['edge007:e'],
  authority:'INTEGRITY_VETO_ONLY',canAuthorizeTrade:false,canAuthorizePromotion:false,
}
const boundary:DexCommissioningBoundary={
  connector:{
    connectorId:'dex:jupiter:canary',provider:'jupiter-ultra',lane:'DEX',admission:'CONTROLLED_CANARY',
    readCapabilities:['quote'],executionCapabilities:['swap'],credentialRef:'secret://jupiter',
    evidenceIds:['connector:e'],authority:'CONNECTOR_METADATA_ONLY',
  },
  wallet:{
    connectionId:'wallet:1',userId:'u1',provider:'coffer-signer',network:'SOLANA',address:'Wallet111',
    mode:'COFFER_EXECUTION_WALLET',connectedAt:'2026-10-03T17:00:00Z',evidenceIds:['wallet:e'],authority:'CONNECTION_ONLY',canSign:false,
  },
  signerPolicy:{
    walletConnectionId:'wallet:1',agentId:'money',sessionId:'commissioning',perTransactionCapMinor:10000n,
    rolling24hCapMinor:20000n,maxTransactionCount:4,allowedDestinationAddresses:['Wallet111'],
    allowedAssets:['SOL','TOKEN'],authority:'OWNER_SIGNER_POLICY',
  },
  signerLease:{
    leaseId:'lease:1',walletConnectionId:'wallet:1',agentId:'money',sessionId:'commissioning',
    tokenFingerprint:'fingerprint',issuedAt:'2026-10-03T17:30:00Z',expiresAt:'2026-10-03T19:30:00Z',
    state:'ACTIVE',authority:'LEASE_METADATA_ONLY',containsPrivateKey:false,containsRawToken:false,
  },
  signerObservation:{
    leaseId:'lease:1',spent24hMinor:0n,transactionCount24h:0,observedAt:'2026-10-03T17:59:30Z',
    evidenceIds:['lease:e'],authority:'SIGNER_EVIDENCE',
  },
}
const intent=():DexSwapIntent=>createApprovedDexSwapIntent({
  draft:{
    executionId:'exec:1',tradeId:'trade:1',requestId:'request:1',runLineageId:'lineage:1',userId:'u1',
    strategyId:'MIGRATION_CONFIRM',instrumentId:'meme:solana:TOKEN',leg:'ENTRY',provider:'jupiter-ultra',
    walletConnectionId:'wallet:1',signerLeaseId:'lease:1',inputMint:'SOL',outputMint:'TOKEN',
    inputAmountAtomic:1000n,minimumOutputAtomic:900n,notionalMinor:5000n,currency:'USD',
    idempotencyKey:'idem:1',informationCutoff:'2026-10-03T17:59:00Z',evidenceIds:['intent:e'],
  },
  governance:{
    sharkAssessmentId:'shark:1',thesisId:'thesis:1',edgeDecisionBundle,integrityGuard:integrity,
    moneyRisk:{riskDecisionId:'risk:1',disposition:'APPROVE',reasonCodes:[],evidenceIds:['risk:e'],evaluatedAt:'2026-10-03T17:59:10Z',authority:'MONEY_RISK_DECISION',canExecute:false},
    approvedAt:'2026-10-03T17:59:20Z',
  },
})

class FakeAdapter implements ManagedSolanaDexAdapter{
  readonly provider='jupiter-ultra' as const
  executeCalls=0
  async createOrder({intent:i,takerAddress}:{intent:DexSwapIntent;takerAddress:string}):Promise<DexManagedOrder>{
    return {
      provider:this.provider,requestId:'provider:'+i.executionId,inputMint:i.inputMint,outputMint:i.outputMint,
      inputAmountAtomic:i.inputAmountAtomic,quotedOutputAtomic:i.minimumOutputAtomic+100n,
      unsignedTransactionBase64:'unsigned:'+i.executionId,takerAddress,evidenceIds:['order:e'],
      authority:'PROVIDER_QUOTE_ONLY',canBroadcast:false,
    }
  }
  async executeSigned():Promise<DexProviderExecutionReceipt>{
    this.executeCalls+=1
    throw new Error('PROVIDER_SUBMISSION_MUST_NOT_BE_CALLED')
  }
}
class FakeSigner implements CofferSignerAdapter{
  readonly provider='remote-coffer'
  calls=0
  async signVersionedTransaction(input:{
    walletConnectionId:string;signerLeaseId:string;unsignedTransactionBase64:string;idempotencyKey:string;expectedSignerAddress:string;now:string
  }):Promise<DexSignedTransaction>{
    this.calls+=1
    return {
      signerProvider:this.provider,walletConnectionId:input.walletConnectionId,signerLeaseId:input.signerLeaseId,
      signerAddress:input.expectedSignerAddress,primarySignature:'sig:1',signedTransactionBase64:'signed:'+input.unsignedTransactionBase64,
      signedTransactionHash:'hash:sig:1',evidenceIds:['signer:e'],authority:'SIGNER_OUTPUT_ONLY',
      containsPrivateKey:false,containsRawToken:false,
    }
  }
}
class FakeChain implements SolanaChainObserver{
  signedPass=true
  async simulateUnsignedTransaction():Promise<DexUnsignedSimulationReceipt>{
    return {simulationId:'sim:unsigned',passed:true,logs:[],observedAt:'2026-10-03T18:00:00Z',evidenceIds:['rpc:unsigned'],authority:'CHAIN_PREFLIGHT_EVIDENCE'}
  }
  async simulateSignedTransaction(input:{signedTransactionBase64:string;primarySignature:string;now:string}):Promise<DexSimulationReceipt>{
    return {
      simulationId:'sim:signed',signature:input.primarySignature,passed:this.signedPass,
      ...(this.signedPass?{feeLamports:5000n}:{errorCode:'SIM_FAILED'}),
      logs:[],observedAt:input.now,evidenceIds:['rpc:signed'],authority:'CHAIN_SIMULATION_EVIDENCE',
    }
  }
  async observeSwap(){throw new Error('ONCHAIN_OBSERVE_MUST_NOT_BE_CALLED')}
}
class Events implements DexExecutionEventSink{
  rows:any[]=[]
  publish(event:any){this.rows.push(event)}
}

test('COMMISSION.9 signs and simulates without any provider submission or broadcast',async()=>{
  const adapter=new FakeAdapter()
  const signer=new FakeSigner()
  const chain=new FakeChain()
  const events=new Events()
  const store=new InMemoryDexExecutionAttemptStore()
  const result=await runSignedDexSimulationNoBroadcast({
    intent:intent(),boundary,adapter,signer,chain,events,attemptStore:store,
    edgeDecisionBundle,integrityGuard:integrity,attemptId:'attempt:1',now:'2026-10-03T18:00:00Z',
  })
  assert.equal(result.attempt.state,'SIMULATED')
  assert.equal(result.attempt.providerReceiptId,undefined)
  assert.ok(result.attempt.evidenceIds.includes(DEX_SIGNED_SIMULATION_NO_BROADCAST_EVIDENCE))
  assert.equal(result.stageEvidence.stage,'SIGNED_SIMULATION_NO_BROADCAST')
  assert.equal(result.stageEvidence.signedTransactionCount,1)
  assert.equal(result.stageEvidence.simulationCount,1)
  assert.equal(result.stageEvidence.broadcastCount,0)
  assert.equal(result.certification.passed,true)
  assert.equal(result.certification.operationalEvidence,true)
  assert.equal(result.providerSubmissionAttempted,false)
  assert.equal(result.canBroadcast,false)
  assert.equal(adapter.executeCalls,0)
  assert.equal(signer.calls,1)
  assert.equal('signed' in result,false)
  assert.deepEqual(events.rows.map(x=>x.type),['TX_SIMULATED','TX_SIGNED','TX_SIMULATED'])
})

test('COMMISSION.9 fails closed when the signed simulation fails',async()=>{
  const adapter=new FakeAdapter()
  const chain=new FakeChain()
  chain.signedPass=false
  const store=new InMemoryDexExecutionAttemptStore()
  await assert.rejects(()=>runSignedDexSimulationNoBroadcast({
    intent:intent(),boundary,adapter,signer:new FakeSigner(),chain,events:new Events(),attemptStore:store,
    edgeDecisionBundle,integrityGuard:integrity,attemptId:'attempt:2',now:'2026-10-03T18:00:00Z',
  }),/DEX_SIGNED_SIMULATION_FAILED/)
  assert.equal((await store.get('attempt:2'))?.state,'FAILED')
  assert.equal(adapter.executeCalls,0)
})

test('COMMISSION.9 rejects replay and evidence that does not match the approved intent',async()=>{
  const adapter=new FakeAdapter()
  const store=new InMemoryDexExecutionAttemptStore()
  const run=()=>runSignedDexSimulationNoBroadcast({
    intent:intent(),boundary,adapter,signer:new FakeSigner(),chain:new FakeChain(),events:new Events(),attemptStore:store,
    edgeDecisionBundle,integrityGuard:integrity,attemptId:'attempt:3',now:'2026-10-03T18:00:00Z',
  })
  await run()
  await assert.rejects(run,/DEX_SIGNED_SIMULATION_DUPLICATE_EXECUTION_BLOCKED/)

  const changed={...edgeDecisionBundle,evidenceIds:['edge:changed']}
  await assert.rejects(()=>runSignedDexSimulationNoBroadcast({
    intent:intent(),boundary,adapter:new FakeAdapter(),signer:new FakeSigner(),chain:new FakeChain(),events:new Events(),
    attemptStore:new InMemoryDexExecutionAttemptStore(),edgeDecisionBundle:changed,integrityGuard:integrity,
    attemptId:'attempt:4',now:'2026-10-03T18:00:00Z',
  }),/DEX_SIGNED_SIMULATION_EDGE_BINDING_MISMATCH/)
})
