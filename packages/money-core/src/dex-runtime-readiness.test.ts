import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateDexRuntimeReadiness } from './dex-runtime-readiness.js'

const now='2026-09-28T02:20:00Z'
const wallet={connectionId:'w1',userId:'u1',provider:'coffer-signer',network:'SOLANA' as const,address:'Wallet111',mode:'COFFER_EXECUTION_WALLET' as const,connectedAt:'2026-09-28T02:00:00Z',evidenceIds:['wallet:e'],authority:'CONNECTION_ONLY' as const,canSign:false as const}
const lease={leaseId:'l1',walletConnectionId:'w1',agentId:'money',sessionId:'s1',tokenFingerprint:'sha256:x',issuedAt:'2026-09-28T02:00:00Z',expiresAt:'2026-09-28T03:00:00Z',state:'ACTIVE' as const,authority:'LEASE_METADATA_ONLY' as const,containsPrivateKey:false as const,containsRawToken:false as const}
const budget={budgetId:'b1',cofferId:'c1',strategyId:'meme',lane:'MEME',currency:'USD',allocatedMinor:10000n,reservedMinor:0n,spentMinor:0n,hardCapMinor:10000n,state:'ACTIVE' as const,observedAt:now,evidenceIds:['budget:e'],authority:'BUDGET_EVIDENCE' as const}
const connector={connectorId:'dex:jupiter:canary',provider:'jupiter-ultra',lane:'DEX' as const,admission:'CONTROLLED_CANARY' as const,readCapabilities:['quote'],executionCapabilities:['swap'],credentialRef:'secret://jupiter/api-key',evidenceIds:['connector:e'],authority:'CONNECTOR_METADATA_ONLY' as const}

test('DEX runtime readiness stays blocked until every external commissioning prerequisite exists',()=>{
 const report=evaluateDexRuntimeReadiness({now,canaryFundingEvidenceIds:[],solFeeReserveEvidenceIds:[],jupiterCredentialConfigured:false,signerEndpointConfigured:false,signerAuthorizationConfigured:false,solanaRpcConfigured:false,settlementMintConfigured:false})
 assert.equal(report.ready,false)
 assert.equal(report.status,'BLOCKED')
 assert.equal(report.checks.length,11)
 assert.ok(report.blockerCodes.includes('DEX_READINESS_COFFER_WALLET_REQUIRED'))
 assert.ok(report.blockerCodes.includes('DEX_READINESS_CANARY_FUNDING_EVIDENCE_REQUIRED'))
 assert.ok(report.blockerCodes.includes('DEX_READINESS_SOL_FEE_RESERVE_EVIDENCE_REQUIRED'))
 assert.equal(report.canExposeSecrets,false)
})

test('DEX runtime readiness passes only for bounded controlled-canary configuration',()=>{
 const report=evaluateDexRuntimeReadiness({
  now,cofferWallet:wallet,signerLease:lease,memeBudget:budget,connector,
  jupiterCredentialConfigured:true,signerEndpointConfigured:true,signerAuthorizationConfigured:true,solanaRpcConfigured:true,settlementMintConfigured:true,
  canaryFundingEvidenceIds:['funding:verified:1'],solFeeReserveEvidenceIds:['sol-reserve:verified:1'],
 })
 assert.equal(report.ready,true)
 assert.equal(report.status,'READY_FOR_CONTROLLED_CANARY')
 assert.deepEqual(report.blockerCodes,[])
 assert.ok(report.checks.every(x=>x.ready&&!x.sensitive))
})

test('expired signer lease, LIVE connector, exhausted budget and owner wallet fail closed',()=>{
 const report=evaluateDexRuntimeReadiness({
  now,
  cofferWallet:{...wallet,mode:'OWNER_WALLET'},
  signerLease:{...lease,expiresAt:'2026-09-28T02:10:00Z'},
  memeBudget:{...budget,spentMinor:10000n},
  connector:{...connector,admission:'LIVE'},
  jupiterCredentialConfigured:true,signerEndpointConfigured:true,signerAuthorizationConfigured:true,solanaRpcConfigured:true,settlementMintConfigured:true,
  canaryFundingEvidenceIds:['funding:e'],solFeeReserveEvidenceIds:['sol:e'],
 })
 assert.equal(report.ready,false)
 assert.ok(report.blockerCodes.includes('DEX_READINESS_COFFER_WALLET_REQUIRED'))
 assert.ok(report.blockerCodes.includes('DEX_READINESS_SIGNER_LEASE_REQUIRED'))
 assert.ok(report.blockerCodes.includes('DEX_READINESS_MEME_BUDGET_REQUIRED'))
 assert.ok(report.blockerCodes.includes('DEX_READINESS_CONTROLLED_CANARY_CONNECTOR_REQUIRED'))
})
