import test from 'node:test'
import assert from 'node:assert/strict'
import {
 REQUIRED_COMMERCIAL_TABLES,IPHONE_PATHS,reviewLive07Restore,reviewLive08StripeTest,
 reviewLive09Iphone,reviewLive10Pilot,reviewAgentBankReferenceObservation
} from './purse-live-07-10-gates.mjs'
const t='2026-10-22T05:25:00Z'
const hash='a'.repeat(64)
const database={checkedAt:t,schemaTables:REQUIRED_COMMERCIAL_TABLES.map(tableName=>({tableName,exists:true})),
 restore:{sourceBackupReceipt:'backup-1',isolatedRestoreReceipt:'restore-1',
 sourceChecksum:hash,restoredChecksum:hash,environment:'ISOLATED_NONPRODUCTION',
 sourceMigrationVersions:['20260801','20261002'],restoredMigrationVersions:['20260801','20261002'],
 crossUserDenied:true,ownerAllowed:true,rlsRehearsalReceipt:'rls-1',schemaReplayReceipt:'replay-1'}}
test('.07 cannot self-certify even a complete read-only backup evidence form',()=>{
 const x=reviewLive07Restore(database)
 assert.equal(x.status,'BLOCKED');assert.equal(x.canMigrate,false)
 assert.ok(x.blockers.includes('EXTERNAL_RESTORE_WITNESS_AND_OWNER_DDL_APPROVAL_REQUIRED'))
})
test('.07 rejects missing tables, version drift and forged duplicate rows',()=>{
 let x=reviewLive07Restore({...database,schemaTables:database.schemaTables.slice(1),
  restore:{...database.restore,restoredMigrationVersions:['20260801','20261101']}})
 assert.ok(x.blockers.some(b=>b.includes('MISSING_COMMERCIAL_TABLE')))
 assert.ok(x.blockers.includes('MIGRATION_VERSION_REPLAY_NOT_VERIFIED'))
 assert.throws(()=>reviewLive07Restore({...database,
  schemaTables:[...database.schemaTables,database.schemaTables[0]]}),/TABLE_EVIDENCE_INVALID/)
})
const stripe={checkedAt:t,testCanary:{environment:'STRIPE_TEST',livemode:false,
 signedEventReceipt:'event-1',providerCheckoutReadback:'session-1',
 providerPaymentIntentReadback:'intent-1',refundReadback:'refund-1',
 durableJournalReadback:'journal-1',verifiedRawSignature:true,
 boundToCanonicalOrder:true,refundReconciled:true}}
test('.08 Stripe TEST evidence cannot become financial authorization',()=>{
 const x=reviewLive08StripeTest(stripe)
 assert.equal(x.canCharge,false);assert.equal(x.canMoveMoney,false)
 assert.ok(x.blockers.includes('OWNER_CONNECTED_STRIPE_TEST_READBACK_REQUIRED'))
})
test('.08 live-mode or duplicated provider receipt fails',()=>{
 assert.ok(reviewLive08StripeTest({...stripe,testCanary:{...stripe.testCanary,livemode:true}}).blockers.includes('STRIPE_TEST_PROVIDER_VERIFICATION_NOT_INDEPENDENT'))
 assert.ok(reviewLive08StripeTest({...stripe,testCanary:{...stripe.testCanary,refundReadback:'intent-1'}}).blockers.includes('STRIPE_TEST_CHECKOUT_WEBHOOK_REFUND_JOURNAL_UNVERIFIED'))
})
const device={checkedAt:t,device:{platform:'IPHONE_SAFARI',sessionReceipt:'session',
 deviceAcceptanceReceipt:'iphone-accept',clickablePaths:[...IPHONE_PATHS],
 portraitLayoutVerified:true,ownerSessionVerified:true,
 unauthorizedSessionDenied:true,logoutVerified:true}}
test('.09 phone checks remain witness gated',()=>{
 const x=reviewLive09Iphone(device);assert.equal(x.canExecute,false)
 assert.ok(x.blockers.includes('INDEPENDENT_REAL_DEVICE_WITNESS_REQUIRED'))
})
test('.09 dead link or unauthorized session blocks',()=>{
 const x=reviewLive09Iphone({...device,device:{...device.device,clickablePaths:IPHONE_PATHS.slice(1),unauthorizedSessionDenied:false}})
 assert.ok(x.blockers.includes('PORTRAIT_NAVIGATION_AND_AUTH_CHECKS_INCOMPLETE'))
})
const pilot={checkedAt:t,pilot:{businessId:'AI_SERVICE',canonicalWorkOrderId:'work-1',
 ownerAuthorizationReceipt:'owner-1',customerConsentReceipt:'consent-1',
 deliveryReceipt:'delivery-1',acceptanceReceipt:'accepted-1',
 independentSettlementReceipt:'settled-1',custodyReadbackReceipt:'custody-1',
 costsAndTaxReconciliationReceipt:'reconcile-1',verifiedPriceMinor:'9900',
 providerMode:'LIVE',currency:'USD'}}
test('.10 no claim of real profits or payday, even with claimed receipts',()=>{
 const x=reviewLive10Pilot(pilot)
 assert.equal(x.status,'BLOCKED');assert.equal(x.canPayOwner,false)
 assert.ok(x.blockers.includes('NO_SELF_ATTESTED_PROFIT_OR_AUTONOMOUS_PAYOUT'))
})
test('.10 missing custody or TEST mode blocked',()=>{
 const x=reviewLive10Pilot({...pilot,pilot:{...pilot.pilot,custodyReadbackReceipt:null,providerMode:'STRIPE_TEST'}})
 assert.ok(x.blockers.includes('DELIVERY_ACCEPTANCE_SETTLEMENT_CUSTODY_RECONCILIATION_REQUIRED'))
 assert.ok(x.blockers.includes('REAL_PAYMENT_PRICE_AND_MODE_NOT_VERIFIED'))
})
test('Agent Bank source import never recognizes invoices or proposed bank transfers as money',()=>{
 const source={source:'different-ai/agent-bank',sourceCommit:'edf977fb0a315728ca1bf247f70249d838b01519',
 mode:'READ_ONLY_RESEARCH',sourceReceipt:'github-commit',
 kind:'TRANSFER_PROPOSAL',referenceId:'proposal-1',observedAt:t,state:'PROPOSED',canExecute:false}
 const x=reviewAgentBankReferenceObservation(source)
 assert.equal(x.recognizedRevenueMinor,null)
 assert.equal(x.canMoveMoney,false)
 assert.equal(x.bankAccountConnected,false)
 assert.throws(()=>reviewAgentBankReferenceObservation({...source,canExecute:true}),/SOURCE_UNTRUSTED/)
})
