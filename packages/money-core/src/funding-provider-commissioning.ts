import { createHash } from 'node:crypto'
import type { FundingDestination,MoneyMovementKind } from './funding-rail-contracts.js'
import type { FundingRailAdmission } from './funding-execution-contracts.js'

export type FundingCommissioningEvidenceClass='REAL_LIVE'|'SYNTHETIC_TEST'
export type FundingCommissioningReceiptKind=
 |'PROVIDER_CONFIGURATION'
 |'OWNER_ACCOUNT_VERIFICATION'
 |'CREDENTIAL_VERIFICATION'
 |'KYC_ELIGIBILITY'
 |'CAPABILITY_PROBE'
 |'WEBHOOK_OR_STATUS_EVIDENCE'
 |'KILL_SWITCH_DRILL'
 |'LIVE_CANARY'
 |'SETTLEMENT_RECONCILIATION'
 |'UNKNOWN_EXECUTION_DRILL'
 |'DUPLICATE_SUBMISSION_DRILL'
 |'CANCEL_DRILL'

export type FundingRailCommissioningReceipt=Readonly<{
 receiptId:string
 railId:string
 provider:string
 providerAccountId:string
 kind:FundingCommissioningReceiptKind
 evidenceClass:FundingCommissioningEvidenceClass
 passed:boolean
 recordedAt:string
 allowedKinds:readonly MoneyMovementKind[]
 allowedCurrencies:readonly string[]
 sourceKinds:readonly FundingDestination['kind'][]
 destinationKinds:readonly FundingDestination['kind'][]
 evidenceIds:readonly string[]
 issuer:'PROVIDER_RUNTIME'|'OPERATIONS'|'MONEY_CERTIFICATION'
 authority:'CERTIFICATION_ONLY'
 canExecute:false
}>

export type FundingRailCanaryEvidence=Readonly<{
 canaryId:string
 railId:string
 provider:string
 providerAccountId:string
 evidenceClass:FundingCommissioningEvidenceClass
 movementId:string
 kind:MoneyMovementKind
 amountMinor:bigint
 currency:string
 approvalReceiptId:string
 executionPermitId:string
 providerReference:string
 providerStates:readonly string[]
 settlementReconciliationId:string
 settlementPassed:boolean
 submittedAt:string
 settledAt:string
 evidenceIds:readonly string[]
 authority:'CANARY_EVIDENCE'
 canExecute:false
}>

export type FundingRailCommissioningCriteria=Readonly<{
 requiredKinds:readonly MoneyMovementKind[]
 requiredCurrencies:readonly string[]
 maximumCanaryAmountMinor:bigint
 liveMaxMovementMinor:bigint
 liveMaxDailyMovementMinor:bigint
}>

export type FundingRailCommissioningCertificate=Readonly<{
 certificateId:string
 railId:string
 provider:string
 providerAccountId:string
 evidenceClass:FundingCommissioningEvidenceClass
 status:'REJECTED'|'SOFTWARE_ONLY'|'CONTROLLED_CANARY_CERTIFIED'|'LIVE_CERTIFIED'
 controlledCanaryCertified:boolean
 liveCertified:boolean
 admittedKinds:readonly MoneyMovementKind[]
 admittedCurrencies:readonly string[]
 sourceKinds:readonly FundingDestination['kind'][]
 destinationKinds:readonly FundingDestination['kind'][]
 maxMovementMinor:bigint
 maxDailyMovementMinor:bigint
 reasonCodes:readonly string[]
 receiptIds:readonly string[]
 canaryIds:readonly string[]
 evidenceIds:readonly string[]
 recordedAt:string
 authority:'CERTIFICATION_ONLY'
 canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const unique=<T extends string>(xs:readonly T[])=>Object.freeze([...new Set(xs)].sort()) as readonly T[]
const iso=(v:string,c:string)=>{if(Number.isNaN(Date.parse(v)))throw new Error(c)}

export function createFundingRailCommissioningReceipt(input:Omit<FundingRailCommissioningReceipt,'receiptId'|'authority'|'canExecute'>):FundingRailCommissioningReceipt{
 if(!input.railId.trim()||!input.provider.trim()||!input.providerAccountId.trim())throw new Error('MONEY_FUND3_PROVIDER_BINDING_REQUIRED')
 iso(input.recordedAt,'MONEY_FUND3_RECEIPT_TIME_INVALID')
 if(!input.evidenceIds.length)throw new Error('MONEY_FUND3_RECEIPT_EVIDENCE_REQUIRED')
 return Object.freeze({...input,allowedKinds:unique(input.allowedKinds),allowedCurrencies:unique(input.allowedCurrencies),sourceKinds:unique(input.sourceKinds),destinationKinds:unique(input.destinationKinds),evidenceIds:unique(input.evidenceIds),receiptId:'funding-commissioning:'+hash({railId:input.railId,provider:input.provider,providerAccountId:input.providerAccountId,kind:input.kind,evidenceClass:input.evidenceClass,passed:input.passed,recordedAt:input.recordedAt,evidenceIds:[...input.evidenceIds].sort()}),authority:'CERTIFICATION_ONLY' as const,canExecute:false as const})
}

function receiptMap(receipts:readonly FundingRailCommissioningReceipt[]){
 const out=new Map<FundingCommissioningReceiptKind,FundingRailCommissioningReceipt>()
 for(const r of receipts)if(r.passed)out.set(r.kind,r)
 return out
}

function commonValidation(input:{receipts:readonly FundingRailCommissioningReceipt[];criteria:FundingRailCommissioningCriteria;railId:string;provider:string;providerAccountId:string}){
 const {receipts,criteria,railId,provider,providerAccountId}=input,reasons:string[]=[]
 if(criteria.maximumCanaryAmountMinor<=0n||criteria.liveMaxMovementMinor<=0n||criteria.liveMaxDailyMovementMinor<=0n)throw new Error('MONEY_FUND3_LIMIT_INVALID')
 if(criteria.liveMaxDailyMovementMinor<criteria.liveMaxMovementMinor)throw new Error('MONEY_FUND3_DAILY_LIMIT_BELOW_MOVEMENT_LIMIT')
 if(criteria.liveMaxMovementMinor<criteria.maximumCanaryAmountMinor)throw new Error('MONEY_FUND3_LIVE_LIMIT_BELOW_CANARY_LIMIT')
 if(!criteria.requiredKinds.length||!criteria.requiredCurrencies.length)throw new Error('MONEY_FUND3_CRITERIA_REQUIRED')
 for(const r of receipts){
  if(r.authority!=='CERTIFICATION_ONLY'||r.canExecute!==false)throw new Error('MONEY_FUND3_RECEIPT_AUTHORITY_INVALID')
  if(r.railId!==railId||r.provider!==provider||r.providerAccountId!==providerAccountId)reasons.push('RECEIPT_BINDING_MISMATCH:'+r.kind)
 }
 const r=receiptMap(receipts)
 for(const kind of ['PROVIDER_CONFIGURATION','OWNER_ACCOUNT_VERIFICATION','CREDENTIAL_VERIFICATION','KYC_ELIGIBILITY','CAPABILITY_PROBE','WEBHOOK_OR_STATUS_EVIDENCE','KILL_SWITCH_DRILL'] as const)if(!r.get(kind))reasons.push(kind+'_REQUIRED')
 const cap=r.get('CAPABILITY_PROBE')
 if(cap){
  for(const k of criteria.requiredKinds)if(!cap.allowedKinds.includes(k))reasons.push('CAPABILITY_KIND_MISSING:'+k)
  for(const c of criteria.requiredCurrencies)if(!cap.allowedCurrencies.includes(c))reasons.push('CAPABILITY_CURRENCY_MISSING:'+c)
  if(!cap.sourceKinds.length||!cap.destinationKinds.length)reasons.push('CAPABILITY_ENDPOINT_KINDS_REQUIRED')
 }
 return {map:r,reasons}
}

export function certifyFundingRailControlledCanary(input:{
 railId:string
 provider:string
 providerAccountId:string
 receipts:readonly FundingRailCommissioningReceipt[]
 criteria:FundingRailCommissioningCriteria
 recordedAt:string
}):FundingRailCommissioningCertificate{
 iso(input.recordedAt,'MONEY_FUND3_CERT_TIME_INVALID')
 const {map,reasons}=commonValidation(input)
 const classes=unique(input.receipts.map(x=>x.evidenceClass))
 const allReal=classes.length===1&&classes[0]==='REAL_LIVE'
 const cap=map.get('CAPABILITY_PROBE')
 const admittedKinds=cap?unique(input.criteria.requiredKinds.filter(x=>cap.allowedKinds.includes(x))):Object.freeze([] as MoneyMovementKind[])
 const admittedCurrencies=cap?unique(input.criteria.requiredCurrencies.filter(x=>cap.allowedCurrencies.includes(x))):Object.freeze([] as string[])
 const sourceKinds=cap?unique(cap.sourceKinds):Object.freeze([] as FundingDestination['kind'][])
 const destinationKinds=cap?unique(cap.destinationKinds):Object.freeze([] as FundingDestination['kind'][])
 const passed=reasons.length===0
 const status:FundingRailCommissioningCertificate['status']=!passed?'REJECTED':allReal?'CONTROLLED_CANARY_CERTIFIED':'SOFTWARE_ONLY'
 return Object.freeze({
  certificateId:'funding-canary-cert:'+hash({railId:input.railId,provider:input.provider,providerAccountId:input.providerAccountId,receipts:input.receipts.map(x=>x.receiptId).sort(),criteria:input.criteria,recordedAt:input.recordedAt}),
  railId:input.railId,provider:input.provider,providerAccountId:input.providerAccountId,evidenceClass:allReal?'REAL_LIVE':'SYNTHETIC_TEST',status,
  controlledCanaryCertified:status==='CONTROLLED_CANARY_CERTIFIED',liveCertified:false,admittedKinds,admittedCurrencies,sourceKinds,destinationKinds,
  maxMovementMinor:input.criteria.maximumCanaryAmountMinor,maxDailyMovementMinor:input.criteria.maximumCanaryAmountMinor,
  reasonCodes:unique(reasons),receiptIds:unique(input.receipts.map(x=>x.receiptId)),canaryIds:Object.freeze([]),evidenceIds:unique(input.receipts.flatMap(x=>x.evidenceIds)),recordedAt:input.recordedAt,authority:'CERTIFICATION_ONLY' as const,canExecute:false as const,
 })
}

export function certifyFundingRailLive(input:{
 controlledCanaryCertificate:FundingRailCommissioningCertificate
 receipts:readonly FundingRailCommissioningReceipt[]
 canaries:readonly FundingRailCanaryEvidence[]
 criteria:FundingRailCommissioningCriteria
 recordedAt:string
}):FundingRailCommissioningCertificate{
 iso(input.recordedAt,'MONEY_FUND3_CERT_TIME_INVALID')
 const c=input.controlledCanaryCertificate,reasons:string[]=[]
 if(!c.controlledCanaryCertified||c.status!=='CONTROLLED_CANARY_CERTIFIED'||c.evidenceClass!=='REAL_LIVE')reasons.push('REAL_CONTROLLED_CANARY_CERT_REQUIRED')
 const {map,reasons:common}=commonValidation({receipts:input.receipts,criteria:input.criteria,railId:c.railId,provider:c.provider,providerAccountId:c.providerAccountId})
 reasons.push(...common)
 for(const kind of ['UNKNOWN_EXECUTION_DRILL','DUPLICATE_SUBMISSION_DRILL','CANCEL_DRILL'] as const)if(!map.get(kind))reasons.push(kind+'_REQUIRED')
 const canaryKinds=new Set<MoneyMovementKind>()
 for(const x of input.canaries){
  if(x.authority!=='CANARY_EVIDENCE'||x.canExecute!==false||!x.evidenceIds.length)reasons.push('CANARY_EVIDENCE_INVALID:'+x.canaryId)
  if(x.evidenceClass!=='REAL_LIVE')reasons.push('REAL_LIVE_CANARY_REQUIRED:'+x.canaryId)
  if(x.railId!==c.railId||x.provider!==c.provider||x.providerAccountId!==c.providerAccountId)reasons.push('CANARY_BINDING_MISMATCH:'+x.canaryId)
  if(x.amountMinor<=0n||x.amountMinor>input.criteria.maximumCanaryAmountMinor)reasons.push('CANARY_AMOUNT_LIMIT:'+x.canaryId)
  if(!input.criteria.requiredCurrencies.includes(x.currency))reasons.push('CANARY_CURRENCY_INVALID:'+x.canaryId)
  if(!x.approvalReceiptId||!x.executionPermitId||!x.providerReference)reasons.push('CANARY_AUTHORITY_LINEAGE_REQUIRED:'+x.canaryId)
  if(!x.providerStates.includes('ACKNOWLEDGED')||!x.providerStates.includes('SETTLED'))reasons.push('CANARY_PROVIDER_LIFECYCLE_INCOMPLETE:'+x.canaryId)
  if(!x.settlementPassed||!x.settlementReconciliationId)reasons.push('CANARY_RECONCILIATION_REQUIRED:'+x.canaryId)
  iso(x.submittedAt,'MONEY_FUND3_CANARY_TIME_INVALID');iso(x.settledAt,'MONEY_FUND3_CANARY_TIME_INVALID')
  if(Date.parse(x.settledAt)<Date.parse(x.submittedAt))reasons.push('CANARY_CLOCK_INVALID:'+x.canaryId)
  canaryKinds.add(x.kind)
 }
 for(const k of input.criteria.requiredKinds)if(!canaryKinds.has(k))reasons.push('REAL_CANARY_KIND_REQUIRED:'+k)
 const allReal=input.receipts.every(x=>x.evidenceClass==='REAL_LIVE')&&input.canaries.every(x=>x.evidenceClass==='REAL_LIVE')
 const passed=reasons.length===0
 const status:FundingRailCommissioningCertificate['status']=!passed?'REJECTED':allReal?'LIVE_CERTIFIED':'SOFTWARE_ONLY'
 return Object.freeze({
  certificateId:'funding-live-cert:'+hash({controlled:c.certificateId,receipts:input.receipts.map(x=>x.receiptId).sort(),canaries:input.canaries.map(x=>x.canaryId).sort(),criteria:input.criteria,recordedAt:input.recordedAt}),
  railId:c.railId,provider:c.provider,providerAccountId:c.providerAccountId,evidenceClass:allReal?'REAL_LIVE':'SYNTHETIC_TEST',status,
  controlledCanaryCertified:c.controlledCanaryCertified,liveCertified:status==='LIVE_CERTIFIED',
  admittedKinds:c.admittedKinds,admittedCurrencies:c.admittedCurrencies,sourceKinds:c.sourceKinds,destinationKinds:c.destinationKinds,
  maxMovementMinor:input.criteria.liveMaxMovementMinor,maxDailyMovementMinor:input.criteria.liveMaxDailyMovementMinor,
  reasonCodes:unique(reasons),receiptIds:unique([...c.receiptIds,...input.receipts.map(x=>x.receiptId)]),canaryIds:unique(input.canaries.map(x=>x.canaryId)),
  evidenceIds:unique([...c.evidenceIds,...input.receipts.flatMap(x=>x.evidenceIds),...input.canaries.flatMap(x=>x.evidenceIds)]),recordedAt:input.recordedAt,authority:'CERTIFICATION_ONLY' as const,canExecute:false as const,
 })
}

export function buildFundingRailAdmissionFromCertificate(input:{certificate:FundingRailCommissioningCertificate;credentialRef:string}):FundingRailAdmission{
 const c=input.certificate
 if(c.authority!=='CERTIFICATION_ONLY'||c.canExecute!==false||c.evidenceClass!=='REAL_LIVE')throw new Error('MONEY_FUND3_REAL_CERTIFICATE_REQUIRED')
 if(c.status!=='CONTROLLED_CANARY_CERTIFIED'&&c.status!=='LIVE_CERTIFIED')throw new Error('MONEY_FUND3_OPERATIONAL_CERTIFICATE_REQUIRED')
 if(!input.credentialRef.trim())throw new Error('MONEY_FUND3_CREDENTIAL_REF_REQUIRED')
 return Object.freeze({
  railId:c.railId,provider:c.provider,environment:'LIVE' as const,admission:c.status==='LIVE_CERTIFIED'?'LIVE' as const:'CONTROLLED_CANARY' as const,
  allowedKinds:c.admittedKinds,allowedCurrencies:c.admittedCurrencies,sourceKinds:c.sourceKinds,destinationKinds:c.destinationKinds,maxMovementMinor:c.maxMovementMinor,maxDailyMovementMinor:c.maxDailyMovementMinor,
  credentialRef:input.credentialRef,evidenceIds:Object.freeze([...c.evidenceIds,'funding-certificate:'+c.certificateId]),authority:'ADMISSION_ONLY' as const,canMoveMoney:false as const,
 })
}
