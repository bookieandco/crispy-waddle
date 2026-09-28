import test from 'node:test'
import assert from 'node:assert/strict'
import {
 buildFundingRailAdmissionFromCertificate,
 certifyFundingRailControlledCanary,
 certifyFundingRailLive,
 createFundingRailCommissioningReceipt,
 type FundingCommissioningEvidenceClass,
 type FundingCommissioningReceiptKind,
 type FundingRailCanaryEvidence,
 type FundingRailCommissioningCriteria,
} from './funding-provider-commissioning.js'

const railId='funding:fixture',provider='funding-fixture',providerAccountId='acct-live-1',at='2026-09-28T01:45:00Z'
const criteria:FundingRailCommissioningCriteria=Object.freeze({
 requiredKinds:Object.freeze(['DEPOSIT','WITHDRAWAL'] as const),
 requiredCurrencies:Object.freeze(['USD'] as const),
 maximumCanaryAmountMinor:100n,
 liveMaxMovementMinor:10000n,
 liveMaxDailyMovementMinor:25000n,
})

function receipt(kind:FundingCommissioningReceiptKind,evidenceClass:FundingCommissioningEvidenceClass='REAL_LIVE'){
 return createFundingRailCommissioningReceipt({
  railId,provider,providerAccountId,kind,evidenceClass,passed:true,recordedAt:at,
  allowedKinds:Object.freeze(['DEPOSIT','WITHDRAWAL','TRANSFER'] as const),
  allowedCurrencies:Object.freeze(['USD'] as const),
  sourceKinds:Object.freeze(['BANK','BROKER_CASH'] as const),
  destinationKinds:Object.freeze(['BANK','BROKER_CASH'] as const),
  evidenceIds:Object.freeze(['evidence:'+kind]),issuer:evidenceClass==='REAL_LIVE'?'OPERATIONS':'MONEY_CERTIFICATION',
 })
}
const canaryReceipts=(e:FundingCommissioningEvidenceClass='REAL_LIVE')=>[
 receipt('PROVIDER_CONFIGURATION',e),receipt('OWNER_ACCOUNT_VERIFICATION',e),receipt('CREDENTIAL_VERIFICATION',e),receipt('KYC_ELIGIBILITY',e),
 receipt('CAPABILITY_PROBE',e),receipt('WEBHOOK_OR_STATUS_EVIDENCE',e),receipt('KILL_SWITCH_DRILL',e),
]
const liveReceipts=()=>[
 ...canaryReceipts(),receipt('LIVE_CANARY'),receipt('SETTLEMENT_RECONCILIATION'),receipt('UNKNOWN_EXECUTION_DRILL'),receipt('DUPLICATE_SUBMISSION_DRILL'),receipt('CANCEL_DRILL'),
]
function canary(kind:'DEPOSIT'|'WITHDRAWAL',evidenceClass:FundingCommissioningEvidenceClass='REAL_LIVE'):FundingRailCanaryEvidence{
 return Object.freeze({
  canaryId:'canary:'+kind.toLowerCase(),railId,provider,providerAccountId,evidenceClass,movementId:'movement:'+kind.toLowerCase(),kind,amountMinor:50n,currency:'USD',
  approvalReceiptId:'approval:'+kind.toLowerCase(),executionPermitId:'permit:'+kind.toLowerCase(),providerReference:'provider-ref:'+kind.toLowerCase(),
  providerStates:Object.freeze(['ACKNOWLEDGED','SETTLED']),settlementReconciliationId:'recon:'+kind.toLowerCase(),settlementPassed:true,
  submittedAt:'2026-09-28T01:46:00Z',settledAt:'2026-09-28T01:47:00Z',evidenceIds:Object.freeze(['canary-evidence:'+kind]),authority:'CANARY_EVIDENCE',canExecute:false,
 })
}

test('MONEY-FUND.3 synthetic commissioning evidence can prove software shape but cannot admit a real rail',()=>{
 const cert=certifyFundingRailControlledCanary({railId,provider,providerAccountId,receipts:canaryReceipts('SYNTHETIC_TEST'),criteria,recordedAt:at})
 assert.equal(cert.status,'SOFTWARE_ONLY')
 assert.equal(cert.controlledCanaryCertified,false)
 assert.equal(cert.liveCertified,false)
 assert.throws(()=>buildFundingRailAdmissionFromCertificate({certificate:cert,credentialRef:'secret://funding'}),/REAL_CERTIFICATE_REQUIRED|OPERATIONAL_CERTIFICATE_REQUIRED/)
})

test('MONEY-FUND.3 real provider account and capability evidence certifies only bounded controlled canary admission',()=>{
 const cert=certifyFundingRailControlledCanary({railId,provider,providerAccountId,receipts:canaryReceipts(),criteria,recordedAt:at})
 assert.equal(cert.status,'CONTROLLED_CANARY_CERTIFIED')
 assert.equal(cert.controlledCanaryCertified,true)
 assert.equal(cert.liveCertified,false)
 assert.equal(cert.maxMovementMinor,100n)
 assert.equal(cert.maxDailyMovementMinor,100n)
 const admission=buildFundingRailAdmissionFromCertificate({certificate:cert,credentialRef:'secret://funding/live'})
 assert.equal(admission.admission,'CONTROLLED_CANARY')
 assert.equal(admission.maxMovementMinor,100n)
 assert.equal(admission.maxDailyMovementMinor,100n)
 assert.equal(admission.canMoveMoney,false)
})

test('MONEY-FUND.3 LIVE promotion requires real settled canaries for both add-funds and cash-out directions',()=>{
 const controlled=certifyFundingRailControlledCanary({railId,provider,providerAccountId,receipts:canaryReceipts(),criteria,recordedAt:at})
 const cert=certifyFundingRailLive({controlledCanaryCertificate:controlled,receipts:liveReceipts(),canaries:[canary('DEPOSIT'),canary('WITHDRAWAL')],criteria,recordedAt:'2026-09-28T01:50:00Z'})
 assert.equal(cert.status,'LIVE_CERTIFIED')
 assert.equal(cert.liveCertified,true)
 assert.deepEqual(cert.admittedKinds,['DEPOSIT','WITHDRAWAL'])
 const admission=buildFundingRailAdmissionFromCertificate({certificate:cert,credentialRef:'secret://funding/live'})
 assert.equal(admission.admission,'LIVE')
 assert.equal(admission.maxMovementMinor,10000n)
 assert.equal(admission.maxDailyMovementMinor,25000n)
 assert.equal(admission.canMoveMoney,false)
})

test('MONEY-FUND.3 LIVE promotion fails when cash-out canary is missing',()=>{
 const controlled=certifyFundingRailControlledCanary({railId,provider,providerAccountId,receipts:canaryReceipts(),criteria,recordedAt:at})
 const cert=certifyFundingRailLive({controlledCanaryCertificate:controlled,receipts:liveReceipts(),canaries:[canary('DEPOSIT')],criteria,recordedAt:'2026-09-28T01:50:00Z'})
 assert.equal(cert.status,'REJECTED')
 assert.ok(cert.reasonCodes.includes('REAL_CANARY_KIND_REQUIRED:WITHDRAWAL'))
 assert.equal(cert.liveCertified,false)
})

test('MONEY-FUND.3 LIVE promotion rejects missing recovery drill receipts',()=>{
 const controlled=certifyFundingRailControlledCanary({railId,provider,providerAccountId,receipts:canaryReceipts(),criteria,recordedAt:at})
 const receipts=liveReceipts().filter(x=>x.kind!=='UNKNOWN_EXECUTION_DRILL')
 const cert=certifyFundingRailLive({controlledCanaryCertificate:controlled,receipts,canaries:[canary('DEPOSIT'),canary('WITHDRAWAL')],criteria,recordedAt:'2026-09-28T01:50:00Z'})
 assert.equal(cert.status,'REJECTED')
 assert.ok(cert.reasonCodes.includes('UNKNOWN_EXECUTION_DRILL_REQUIRED'))
})

test('MONEY-FUND.3 synthetic live canary can never promote a real rail',()=>{
 const controlled=certifyFundingRailControlledCanary({railId,provider,providerAccountId,receipts:canaryReceipts(),criteria,recordedAt:at})
 const cert=certifyFundingRailLive({controlledCanaryCertificate:controlled,receipts:liveReceipts(),canaries:[canary('DEPOSIT','SYNTHETIC_TEST'),canary('WITHDRAWAL','SYNTHETIC_TEST')],criteria,recordedAt:'2026-09-28T01:50:00Z'})
 assert.equal(cert.status,'REJECTED')
 assert.ok(cert.reasonCodes.some(x=>x.startsWith('REAL_LIVE_CANARY_REQUIRED:')))
 assert.equal(cert.liveCertified,false)
})
