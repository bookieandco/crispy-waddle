import type { SqlClient } from './postgres-idempotency-store.js'
import { buildFundingRailAdmissionFromCertificate,type FundingRailCommissioningCertificate,type FundingRailCommissioningReceipt } from './funding-provider-commissioning.js'

type ReceiptRow=Readonly<{
 receipt_id:string;rail_id:string;provider:string;provider_account_id:string;kind:FundingRailCommissioningReceipt['kind'];evidence_class:FundingRailCommissioningReceipt['evidenceClass'];passed:boolean;recorded_at:string|Date;
 allowed_kinds:FundingRailCommissioningReceipt['allowedKinds'];allowed_currencies:string[];source_kinds:FundingRailCommissioningReceipt['sourceKinds'];destination_kinds:FundingRailCommissioningReceipt['destinationKinds'];evidence_ids:string[];issuer:FundingRailCommissioningReceipt['issuer']
}>
type CertificateRow=Readonly<{
 certificate_id:string;rail_id:string;provider:string;provider_account_id:string;evidence_class:FundingRailCommissioningCertificate['evidenceClass'];status:FundingRailCommissioningCertificate['status'];
 controlled_canary_certified:boolean;live_certified:boolean;admitted_kinds:FundingRailCommissioningCertificate['admittedKinds'];admitted_currencies:string[];source_kinds:FundingRailCommissioningCertificate['sourceKinds'];destination_kinds:FundingRailCommissioningCertificate['destinationKinds'];
 max_movement_minor:string|number|bigint;max_daily_movement_minor:string|number|bigint;reason_codes:string[];receipt_ids:string[];canary_ids:string[];evidence_ids:string[];recorded_at:string|Date
}>
const iso=(v:string|Date)=>v instanceof Date?v.toISOString():new Date(v).toISOString()
function mapReceipt(x:ReceiptRow):FundingRailCommissioningReceipt{return Object.freeze({receiptId:x.receipt_id,railId:x.rail_id,provider:x.provider,providerAccountId:x.provider_account_id,kind:x.kind,evidenceClass:x.evidence_class,passed:x.passed,recordedAt:iso(x.recorded_at),allowedKinds:Object.freeze(x.allowed_kinds??[]),allowedCurrencies:Object.freeze(x.allowed_currencies??[]),sourceKinds:Object.freeze(x.source_kinds??[]),destinationKinds:Object.freeze(x.destination_kinds??[]),evidenceIds:Object.freeze(x.evidence_ids??[]),issuer:x.issuer,authority:'CERTIFICATION_ONLY' as const,canExecute:false as const})}
function mapCertificate(x:CertificateRow):FundingRailCommissioningCertificate{return Object.freeze({certificateId:x.certificate_id,railId:x.rail_id,provider:x.provider,providerAccountId:x.provider_account_id,evidenceClass:x.evidence_class,status:x.status,controlledCanaryCertified:x.controlled_canary_certified,liveCertified:x.live_certified,admittedKinds:Object.freeze(x.admitted_kinds??[]),admittedCurrencies:Object.freeze(x.admitted_currencies??[]),sourceKinds:Object.freeze(x.source_kinds??[]),destinationKinds:Object.freeze(x.destination_kinds??[]),maxMovementMinor:BigInt(x.max_movement_minor),maxDailyMovementMinor:BigInt(x.max_daily_movement_minor),reasonCodes:Object.freeze(x.reason_codes??[]),receiptIds:Object.freeze(x.receipt_ids??[]),canaryIds:Object.freeze(x.canary_ids??[]),evidenceIds:Object.freeze(x.evidence_ids??[]),recordedAt:iso(x.recorded_at),authority:'CERTIFICATION_ONLY' as const,canExecute:false as const})}

export class PostgresFundingRailCommissioningStore{
 constructor(private readonly client:SqlClient){}
 async putReceipt(r:FundingRailCommissioningReceipt){
  if(r.authority!=='CERTIFICATION_ONLY'||r.canExecute!==false)throw new Error('MONEY_FUND3_RECEIPT_AUTHORITY_INVALID')
  const q=await this.client.query(`INSERT INTO money_funding_commissioning_receipts(receipt_id,rail_id,provider,provider_account_id,kind,evidence_class,passed,recorded_at,allowed_kinds,allowed_currencies,source_kinds,destination_kinds,evidence_ids,issuer) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(receipt_id) DO NOTHING RETURNING receipt_id`,[r.receiptId,r.railId,r.provider,r.providerAccountId,r.kind,r.evidenceClass,r.passed,r.recordedAt,[...r.allowedKinds],[...r.allowedCurrencies],[...r.sourceKinds],[...r.destinationKinds],[...r.evidenceIds],r.issuer])
  if((q.rowCount??q.rows.length)!==1)throw new Error('MONEY_FUND3_RECEIPT_EXISTS')
 }
 async putCertificate(c:FundingRailCommissioningCertificate){
  if(c.authority!=='CERTIFICATION_ONLY'||c.canExecute!==false)throw new Error('MONEY_FUND3_CERT_AUTHORITY_INVALID')
  const q=await this.client.query(`INSERT INTO money_funding_commissioning_certificates(certificate_id,rail_id,provider,provider_account_id,evidence_class,status,controlled_canary_certified,live_certified,admitted_kinds,admitted_currencies,source_kinds,destination_kinds,max_movement_minor,max_daily_movement_minor,reason_codes,receipt_ids,canary_ids,evidence_ids,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ON CONFLICT(certificate_id) DO NOTHING RETURNING certificate_id`,[c.certificateId,c.railId,c.provider,c.providerAccountId,c.evidenceClass,c.status,c.controlledCanaryCertified,c.liveCertified,[...c.admittedKinds],[...c.admittedCurrencies],[...c.sourceKinds],[...c.destinationKinds],c.maxMovementMinor.toString(),c.maxDailyMovementMinor.toString(),[...c.reasonCodes],[...c.receiptIds],[...c.canaryIds],[...c.evidenceIds],c.recordedAt])
  if((q.rowCount??q.rows.length)!==1)throw new Error('MONEY_FUND3_CERT_EXISTS')
 }
 async listReceipts(railId:string):Promise<readonly FundingRailCommissioningReceipt[]>{
  const q=await this.client.query<ReceiptRow>('SELECT receipt_id,rail_id,provider,provider_account_id,kind,evidence_class,passed,recorded_at,allowed_kinds,allowed_currencies,source_kinds,destination_kinds,evidence_ids,issuer FROM money_funding_commissioning_receipts WHERE rail_id=$1 ORDER BY recorded_at ASC,receipt_id ASC',[railId]);return Object.freeze(q.rows.map(mapReceipt))
 }

 async getCertificate(certificateId:string):Promise<FundingRailCommissioningCertificate|undefined>{
  const q=await this.client.query<CertificateRow>('SELECT certificate_id,rail_id,provider,provider_account_id,evidence_class,status,controlled_canary_certified,live_certified,admitted_kinds,admitted_currencies,source_kinds,destination_kinds,max_movement_minor,max_daily_movement_minor,reason_codes,receipt_ids,canary_ids,evidence_ids,recorded_at FROM money_funding_commissioning_certificates WHERE certificate_id=$1 LIMIT 1',[certificateId]);return q.rows[0]?mapCertificate(q.rows[0]):undefined
 }
 async promoteAdmission(input:{certificate:FundingRailCommissioningCertificate;credentialRef:string;promotedAt:string}):Promise<void>{
  const persisted=await this.getCertificate(input.certificate.certificateId)
  if(!persisted)throw new Error('MONEY_FUND3_CERTIFICATE_NOT_PERSISTED')
  if(persisted.certificateId!==input.certificate.certificateId||persisted.status!==input.certificate.status||persisted.evidenceClass!==input.certificate.evidenceClass)throw new Error('MONEY_FUND3_CERTIFICATE_PERSISTENCE_MISMATCH')
  const admission=buildFundingRailAdmissionFromCertificate({certificate:input.certificate,credentialRef:input.credentialRef})
  const q=await this.client.query(
   'UPDATE money_funding_rail_admissions SET provider=$1,environment=$2,admission=$3,allowed_kinds=$4,allowed_currencies=$5,source_kinds=$6,destination_kinds=$7,max_movement_minor=$8,max_daily_movement_minor=$9,credential_ref=$10,commissioning_certificate_id=$11,evidence_ids=$12,updated_at=$13 WHERE rail_id=$14 RETURNING rail_id',
   [admission.provider,admission.environment,admission.admission,[...admission.allowedKinds],[...admission.allowedCurrencies],[...admission.sourceKinds],[...admission.destinationKinds],admission.maxMovementMinor.toString(),admission.maxDailyMovementMinor.toString(),admission.credentialRef??null,admission.commissioningCertificateId,[...admission.evidenceIds],input.promotedAt,admission.railId],
  )
  if((q.rowCount??q.rows.length)!==1)throw new Error('MONEY_FUND3_ADMISSION_ROW_REQUIRED')
 }
 async demoteAdmission(input:{railId:string;demotedAt:string;evidenceIds:readonly string[]}):Promise<void>{
  if(!input.evidenceIds.length)throw new Error('MONEY_FUND3_DEMOTION_EVIDENCE_REQUIRED')
  const q=await this.client.query(
   "UPDATE money_funding_rail_admissions SET admission='READ_ONLY',max_movement_minor=0,max_daily_movement_minor=0,evidence_ids=$1,updated_at=$2 WHERE rail_id=$3 RETURNING rail_id",
   [[...input.evidenceIds],input.demotedAt,input.railId],
  )
  if((q.rowCount??q.rows.length)!==1)throw new Error('MONEY_FUND3_ADMISSION_ROW_REQUIRED')
 }
 async latestCertificate(railId:string):Promise<FundingRailCommissioningCertificate|undefined>{
  const q=await this.client.query<CertificateRow>('SELECT certificate_id,rail_id,provider,provider_account_id,evidence_class,status,controlled_canary_certified,live_certified,admitted_kinds,admitted_currencies,source_kinds,destination_kinds,max_movement_minor,max_daily_movement_minor,reason_codes,receipt_ids,canary_ids,evidence_ids,recorded_at FROM money_funding_commissioning_certificates WHERE rail_id=$1 ORDER BY recorded_at DESC,certificate_id DESC LIMIT 1',[railId]);return q.rows[0]?mapCertificate(q.rows[0]):undefined
 }
}
