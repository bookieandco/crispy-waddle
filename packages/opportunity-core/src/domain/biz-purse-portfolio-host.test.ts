import assert from 'node:assert/strict'
import test from 'node:test'
import {assessMultiBusinessIsolation,assessUnattendedHost} from './biz-purse-portfolio-host.js'
const units=[
 {businessId:'client-studio',ownerUserId:'owner:1',accountId:'account:1',customerRefs:['c:1'],ledgerReceiptIds:['r:1'],operatingBudgetMinor:10000n,reservedSpendMinor:1000n},
 {businessId:'digital-products',ownerUserId:'owner:1',accountId:'account:2',customerRefs:['c:2'],ledgerReceiptIds:['r:2'],operatingBudgetMinor:12000n,reservedSpendMinor:1200n}
]
const host={ownerUserId:'owner:1',ownerAttestedHostId:'host:1',workerHostId:'host:1',pinnedGitSha:'a'.repeat(40),observedGitSha:'a'.repeat(40),observedAt:'2026-10-14T23:00:00Z',leaseExpiresAt:'2026-10-15T00:00:00Z',exclusiveLeaseVerified:true,restartFencingDrillPassed:true,appendOnlyJournalVerified:true,backupDigest:'b'.repeat(64),restoredDigest:'b'.repeat(64),isolatedRestoreVerified:true,phoneAuthenticatedReadbackVerified:true,platformCostApproved:false,platformIsFree:true}
test('separate real businesses can reach review without launch authority',()=>{const r=assessMultiBusinessIsolation({ownerUserId:'owner:1',units,aggregateBudgetCapMinor:30000n});assert.equal(r.status,'REVIEW_READY');assert.equal(r.maySpend,false)})
test('cross-owner, shared-account and reused customer/ledger identifiers block',()=>{const r=assessMultiBusinessIsolation({ownerUserId:'owner:1',units:[units[0],{...units[1],accountId:'account:1',ownerUserId:'other',customerRefs:['c:1'],ledgerReceiptIds:['r:1']}],aggregateBudgetCapMinor:30000n});assert.equal(r.status,'BLOCKED');assert(r.reasons.includes('CROSS_BUSINESS_LEDGER_COLLISION'))})
test('aggregate budget never exceeds owner cap',()=>{const r=assessMultiBusinessIsolation({ownerUserId:'owner:1',units,aggregateBudgetCapMinor:20000n});assert.equal(r.status,'BLOCKED');assert(r.reasons.includes('PORTFOLIO_AGGREGATE_BUDGET_EXCEEDED'))})
test('host with all evidence is a review only, not authority to launch or spend',()=>{const r=assessUnattendedHost(host);assert.equal(r.status,'REVIEW_READY');assert.equal(r.canRunUnattended,false);assert.equal(r.canExecuteTransactions,false)})
test('unverified restore, expired lease, mismatched SHA and unapproved cost block',()=>{const r=assessUnattendedHost({...host,workerHostId:'other',leaseExpiresAt:'2026-10-14T22:00:00Z',observedGitSha:'c'.repeat(40),restoredDigest:'d'.repeat(64),platformIsFree:false});assert.equal(r.status,'BLOCKED');assert(r.reasons.includes('INDEPENDENT_RESTORE_NOT_PROVEN'));assert(r.reasons.includes('HOST_COST_NOT_APPROVED'))})
