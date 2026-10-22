// JH-PURSE-SELF-FUND.LIVE.07–.10
// Admission review ONLY. These inputs are not independently authenticated;
 // even a complete packet never changes database, provider, or payment authority.
export const REQUIRED_COMMERCIAL_TABLES=Object.freeze([
 'jhadina_side_hustle_work_orders',
 'jhadina_side_hustle_commercial_receipts',
 'jhadina_side_hustle_commerce_records',
 'jhadina_side_hustle_commissioning_evidence',
 'jhadina_digital_product_studio_records',
])
export const IPHONE_PATHS=Object.freeze([
 '/money/command-center','/money/purse','/money/commissioning',
 '/opportunity/side-hustles',
])
const name=x=>typeof x==='string'&&x.trim().length>0&&x.length<=260
const distinct=x=>Array.isArray(x)&&x.every(name)&&new Set(x).size===x.length
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)
const isTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))
const minor=x=>typeof x==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(x)
const out=(phase,blockers,evidence)=>{
 const status=blockers.length?'BLOCKED':'INDEPENDENT_REVIEW_REQUIRED'
 return Object.freeze({
  phase,status,blockers:Object.freeze([...new Set(blockers)]),
  evidenceRefs:Object.freeze([...new Set(evidence)]),
  authority:'EVIDENCE_INVENTORY_ONLY',
  independentlyCertified:false,canMigrate:false,canCharge:false,
  canSendInvoice:false,canPayOwner:false,canMoveMoney:false,canTrade:false,canExecute:false,
 })
}

export function reviewLive07Restore(input){
 if(!input||!Array.isArray(input.schemaTables)||!isTime(input.checkedAt))
  throw Error('PURSE_07_INPUT_INVALID')
 const tables=new Map()
 for(const t of input.schemaTables){
  if(!t||!name(t.tableName)||typeof t.exists!=='boolean'||tables.has(t.tableName))
   throw Error('PURSE_07_TABLE_EVIDENCE_INVALID')
  tables.set(t.tableName,t)
 }
 const b=[],refs=[]
 for(const n of REQUIRED_COMMERCIAL_TABLES){
  if(tables.get(n)?.exists!==true)b.push('MISSING_COMMERCIAL_TABLE:'+n)
 }
 const s=input.restore
 if(!s||!name(s.sourceBackupReceipt)||!name(s.isolatedRestoreReceipt)||
    s.sourceBackupReceipt===s.isolatedRestoreReceipt||!sha(s.sourceChecksum)||
    !sha(s.restoredChecksum)||s.sourceChecksum!==s.restoredChecksum||
    s.environment!=='ISOLATED_NONPRODUCTION')
  b.push('INDEPENDENT_RESTORE_NOT_EVIDENCED')
 else refs.push(s.sourceBackupReceipt,s.isolatedRestoreReceipt)
 if(!s||!distinct(s.sourceMigrationVersions)||!distinct(s.restoredMigrationVersions)||
   s.sourceMigrationVersions.length!==s.restoredMigrationVersions.length||
   s.sourceMigrationVersions.some((v,i)=>v!==s.restoredMigrationVersions[i]))
  b.push('MIGRATION_VERSION_REPLAY_NOT_VERIFIED')
 if(!s||s.crossUserDenied!==true||s.ownerAllowed!==true||
    !name(s.rlsRehearsalReceipt)||!name(s.schemaReplayReceipt))
  b.push('INDEPENDENT_RLS_AND_SCHEMA_REPLAY_REQUIRED')
 // Claimed receipts are not signature-verified attestations.
 b.push('EXTERNAL_RESTORE_WITNESS_AND_OWNER_DDL_APPROVAL_REQUIRED')
 return out('.07',b,refs)
}
export function reviewLive08StripeTest(input){
 if(!input||!isTime(input.checkedAt))throw Error('PURSE_08_INPUT_INVALID')
 const b=[],r=[]
 const x=input.testCanary
 if(!x||x.environment!=='STRIPE_TEST'||!name(x.signedEventReceipt)||
    !name(x.providerCheckoutReadback)||!name(x.providerPaymentIntentReadback)||
    !name(x.refundReadback)||!name(x.durableJournalReadback)||
    !distinct([x.signedEventReceipt,x.providerCheckoutReadback,
       x.providerPaymentIntentReadback,x.refundReadback,x.durableJournalReadback]))
   b.push('STRIPE_TEST_CHECKOUT_WEBHOOK_REFUND_JOURNAL_UNVERIFIED')
 else r.push(x.signedEventReceipt,x.providerCheckoutReadback,
   x.providerPaymentIntentReadback,x.refundReadback,x.durableJournalReadback)
 if(!x||x.livemode!==false||x.verifiedRawSignature!==true||
   x.boundToCanonicalOrder!==true||x.refundReconciled!==true)
  b.push('STRIPE_TEST_PROVIDER_VERIFICATION_NOT_INDEPENDENT')
 // Existing Stripe TEST verifier, Commerce and Action Core must perform
 // actual signed-webhook and provider GET checks. No values above mint them.
 b.push('OWNER_CONNECTED_STRIPE_TEST_READBACK_REQUIRED')
 return out('.08',b,r)
}
export function reviewLive09Iphone(input){
 if(!input||!isTime(input.checkedAt))throw Error('PURSE_09_INPUT_INVALID')
 const b=[],r=[]
 const x=input.device
 if(!x||x.platform!=='IPHONE_SAFARI'||!name(x.sessionReceipt)||
    !name(x.deviceAcceptanceReceipt)||x.sessionReceipt===x.deviceAcceptanceReceipt)
  b.push('REAL_IPHONE_SESSION_AND_ACCEPTANCE_MISSING')
 else r.push(x.sessionReceipt,x.deviceAcceptanceReceipt)
 if(!x||!distinct(x.clickablePaths)||IPHONE_PATHS.some(p=>!x.clickablePaths.includes(p))||
    x.portraitLayoutVerified!==true||x.ownerSessionVerified!==true||
    x.unauthorizedSessionDenied!==true||x.logoutVerified!==true)
  b.push('PORTRAIT_NAVIGATION_AND_AUTH_CHECKS_INCOMPLETE')
 b.push('INDEPENDENT_REAL_DEVICE_WITNESS_REQUIRED')
 return out('.09',b,r)
}
export function reviewLive10Pilot(input){
 if(!input||!isTime(input.checkedAt))throw Error('PURSE_10_INPUT_INVALID')
 const x=input.pilot,b=[],r=[]
 if(!x||!name(x.businessId)||!name(x.canonicalWorkOrderId)||
    !name(x.ownerAuthorizationReceipt)||!name(x.customerConsentReceipt)||
    x.ownerAuthorizationReceipt===x.customerConsentReceipt)
  b.push('OWNER_APPROVED_CONSENTED_CUSTOMER_WORK_ORDER_REQUIRED')
 else r.push(x.ownerAuthorizationReceipt,x.customerConsentReceipt)
 if(!x||!name(x.deliveryReceipt)||!name(x.acceptanceReceipt)||
    !name(x.independentSettlementReceipt)||!name(x.custodyReadbackReceipt)||
    !name(x.costsAndTaxReconciliationReceipt))
  b.push('DELIVERY_ACCEPTANCE_SETTLEMENT_CUSTODY_RECONCILIATION_REQUIRED')
 if(!x||!minor(x.verifiedPriceMinor)||x.verifiedPriceMinor==='0'||
    x.currency!=='USD'||x.providerMode!=='LIVE')
  b.push('REAL_PAYMENT_PRICE_AND_MODE_NOT_VERIFIED')
 b.push('NO_SELF_ATTESTED_PROFIT_OR_AUTONOMOUS_PAYOUT')
 return out('.10',b,r)
}
export function reviewAgentBankReferenceObservation(input){
 if(!input||input.source!=='different-ai/agent-bank'||
    input.sourceCommit!=='edf977fb0a315728ca1bf247f70249d838b01519'||
    input.mode!=='READ_ONLY_RESEARCH'||!name(input.sourceReceipt)||
    !['INVOICE','TRANSFER_PROPOSAL','BALANCE_OBSERVATION'].includes(input.kind)||
    !name(input.referenceId)||!isTime(input.observedAt)||
    !['DRAFT','PROPOSED','OBSERVED','UNKNOWN'].includes(input.state)||
    input.canExecute!==false)
  throw Error('PURSE_AGENT_BANK_SOURCE_UNTRUSTED')
 // No upstream private API is contacted or key accepted; status is NOT settlement.
 return Object.freeze({
  kind:input.kind,referenceId:input.referenceId,status:'UNVERIFIED_SOURCE_OBSERVATION',
  receiptRef:input.sourceReceipt,authority:'RESEARCH_ONLY',
  bankAccountConnected:false,providerSettlementVerified:false,
  recognizedRevenueMinor:null,canProposeTransfer:false,
  canSendInvoice:false,canMoveMoney:false,canExecute:false,
 })
}
