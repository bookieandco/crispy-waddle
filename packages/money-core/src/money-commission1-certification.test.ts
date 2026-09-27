import test from 'node:test'
import assert from 'node:assert/strict'
import { remainingStrategyBudget,reserveStrategySpend,type StrategyBudgetSnapshot } from './strategy-budget-contracts.js'
import { assertSignerLeaseMayPrepare,type SignerLease,type SignerLeasePolicy,type SignerRollingObservation } from './signer-lease-contracts.js'
import { applyProviderSyncPage,assertProviderSyncAccountIncluded,markProviderSyncError,type ProviderSyncCheckpoint } from './provider-sync-contracts.js'
import { assertBrokerSurfaceEligibleForCommissioning,ROBINHOOD_NODE_REFERENCE_SURFACE } from './broker-surface-contracts.js'

const budget=(o:Partial<StrategyBudgetSnapshot>={}):StrategyBudgetSnapshot=>({
 budgetId:'b1',cofferId:'c1',strategyId:'s1',lane:'DEX',currency:'USD',allocatedMinor:100000n,reservedMinor:10000n,spentMinor:20000n,hardCapMinor:80000n,state:'ACTIVE',observedAt:'2026-09-27T23:15:00Z',evidenceIds:['ledger:budget'],authority:'BUDGET_EVIDENCE',...o
})

test('MONEY-COMMISSION.1 strategy budget uses hard cap and forbids overdraft',()=>{
 assert.equal(remainingStrategyBudget(budget()),50000n)
 const r=reserveStrategySpend({snapshot:budget(),reservationId:'r1',amountMinor:30000n,createdAt:'2026-09-27T23:15:00Z',expiresAt:'2026-09-27T23:30:00Z'})
 assert.equal(r.remainingAfterMinor,20000n)
 assert.equal(r.canExecute,false)
 assert.throws(()=>reserveStrategySpend({snapshot:budget(),reservationId:'r2',amountMinor:50001n,createdAt:'2026-09-27T23:15:00Z',expiresAt:'2026-09-27T23:30:00Z'}),/NO_OVERDRAFT/)
})

test('MONEY-COMMISSION.1 exhausted or halted strategy budgets cannot reserve',()=>{
 assert.throws(()=>reserveStrategySpend({snapshot:budget({state:'HALTED'}),reservationId:'r',amountMinor:1n,createdAt:'2026-09-27T23:15:00Z',expiresAt:'2026-09-27T23:30:00Z'}),/NOT_ACTIVE/)
 assert.throws(()=>reserveStrategySpend({snapshot:budget({allocatedMinor:10000n,reservedMinor:10000n,spentMinor:0n,hardCapMinor:10000n}),reservationId:'r',amountMinor:1n,createdAt:'2026-09-27T23:15:00Z',expiresAt:'2026-09-27T23:30:00Z'}),/EXHAUSTED/)
})

test('MONEY-COMMISSION.1 signer lease is secret-free and bounded by session caps',()=>{
 const policy:SignerLeasePolicy={walletConnectionId:'w1',agentId:'money',sessionId:'sess1',perTransactionCapMinor:10000n,rolling24hCapMinor:25000n,maxTransactionCount:3,allowedDestinationAddresses:['0xabc'],allowedAssets:['USDC'],authority:'OWNER_SIGNER_POLICY'}
 const lease:SignerLease={leaseId:'l1',walletConnectionId:'w1',agentId:'money',sessionId:'sess1',tokenFingerprint:'sha256:abc',issuedAt:'2026-09-27T23:00:00Z',expiresAt:'2026-09-27T23:20:00Z',state:'ACTIVE',authority:'LEASE_METADATA_ONLY',containsPrivateKey:false,containsRawToken:false}
 const obs:SignerRollingObservation={leaseId:'l1',spent24hMinor:12000n,transactionCount24h:2,observedAt:'2026-09-27T23:15:00Z',evidenceIds:['wallet:history'],authority:'SIGNER_EVIDENCE'}
 assert.doesNotThrow(()=>assertSignerLeaseMayPrepare({policy,lease,observation:obs,intent:{amountMinor:9000n,assetId:'USDC',destinationAddress:'0xabc',now:'2026-09-27T23:15:00Z'}}))
 assert.throws(()=>assertSignerLeaseMayPrepare({policy,lease,observation:obs,intent:{amountMinor:10001n,assetId:'USDC',destinationAddress:'0xabc',now:'2026-09-27T23:15:00Z'}}),/PER_TX_CAP/)
 assert.throws(()=>assertSignerLeaseMayPrepare({policy,lease,observation:{...obs,spent24hMinor:20000n},intent:{amountMinor:6000n,assetId:'USDC',destinationAddress:'0xabc',now:'2026-09-27T23:15:00Z'}}),/ROLLING_CAP/)
 assert.throws(()=>assertSignerLeaseMayPrepare({policy,lease,observation:obs,intent:{amountMinor:1000n,assetId:'USDC',destinationAddress:'0xdef',now:'2026-09-27T23:15:00Z'}}),/DESTINATION_BLOCKED/)
})

test('MONEY-COMMISSION.1 signer lease expires fail-closed',()=>{
 const policy:SignerLeasePolicy={walletConnectionId:'w1',agentId:'money',sessionId:'s1',perTransactionCapMinor:1000n,rolling24hCapMinor:2000n,maxTransactionCount:2,allowedDestinationAddresses:['0xabc'],allowedAssets:['USDC'],authority:'OWNER_SIGNER_POLICY'}
 const lease:SignerLease={leaseId:'l1',walletConnectionId:'w1',agentId:'money',sessionId:'s1',tokenFingerprint:'sha256:abc',issuedAt:'2026-09-27T23:00:00Z',expiresAt:'2026-09-27T23:10:00Z',state:'ACTIVE',authority:'LEASE_METADATA_ONLY',containsPrivateKey:false,containsRawToken:false}
 const obs:SignerRollingObservation={leaseId:'l1',spent24hMinor:0n,transactionCount24h:0,observedAt:'2026-09-27T23:11:00Z',evidenceIds:['e'],authority:'SIGNER_EVIDENCE'}
 assert.throws(()=>assertSignerLeaseMayPrepare({policy,lease,observation:obs,intent:{amountMinor:1n,assetId:'USDC',destinationAddress:'0xabc',now:'2026-09-27T23:11:00Z'}}),/LEASE_EXPIRED/)
})

test('MONEY-COMMISSION.1 provider sync advances only from the exact cursor',()=>{
 const c:ProviderSyncCheckpoint={syncId:'sync1',userId:'u1',provider:'plaid',providerItemId:'item1',cursor:'cur1',state:'ACTIVE',includedAccountIds:['a1'],lastSuccessfulSyncAt:'2026-09-27T22:00:00Z',evidenceIds:['checkpoint'],authority:'SYNC_CHECKPOINT'}
 const r=applyProviderSyncPage({checkpoint:c,page:{requestId:'req1',previousCursor:'cur1',nextCursor:'cur2',hasMore:false,addedTransactionIds:['t1'],modifiedTransactionIds:[],removedTransactionIds:[],observedAt:'2026-09-27T23:15:00Z',evidenceIds:['plaid:req1'],authority:'SYNC_EVIDENCE'}})
 assert.equal(r.next.cursor,'cur2')
 assert.equal(r.next.state,'ACTIVE')
 assert.equal(r.next.lastSuccessfulSyncAt,'2026-09-27T23:15:00Z')
 assert.throws(()=>applyProviderSyncPage({checkpoint:c,page:{requestId:'req2',previousCursor:'stale',nextCursor:'cur3',hasMore:false,addedTransactionIds:[],modifiedTransactionIds:[],removedTransactionIds:[],observedAt:'2026-09-27T23:16:00Z',evidenceIds:['plaid:req2'],authority:'SYNC_EVIDENCE'}}),/CURSOR_MISMATCH/)
})

test('MONEY-COMMISSION.1 Plaid login-required becomes an explicit reauth state and account filters fail closed',()=>{
 const c:ProviderSyncCheckpoint={syncId:'sync1',userId:'u1',provider:'plaid',providerItemId:'item1',cursor:'cur1',state:'ACTIVE',includedAccountIds:['a1'],evidenceIds:['checkpoint'],authority:'SYNC_CHECKPOINT'}
 const next=markProviderSyncError(c,{code:'ITEM_LOGIN_REQUIRED',observedAt:'2026-09-27T23:15:00Z',evidenceId:'plaid:error'})
 assert.equal(next.state,'LOGIN_REQUIRED')
 assert.doesNotThrow(()=>assertProviderSyncAccountIncluded(next,'a1'))
 assert.throws(()=>assertProviderSyncAccountIncluded(next,'a2'),/ACCOUNT_FILTERED/)
})

test('MONEY-COMMISSION.1 reverse-engineered private broker surfaces can never be commissioned for live execution',()=>{
 assert.equal(ROBINHOOD_NODE_REFERENCE_SURFACE.executionAllowed,false)
 assert.throws(()=>assertBrokerSurfaceEligibleForCommissioning(ROBINHOOD_NODE_REFERENCE_SURFACE),/UNOFFICIAL_BROKER_EXECUTION_FORBIDDEN/)
})
