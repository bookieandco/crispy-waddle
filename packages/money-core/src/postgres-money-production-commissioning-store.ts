import type { SqlClient } from './postgres-idempotency-store.js'
import type { MoneyProductionCommissioningReceipt,MoneyProductionLane,MoneyProductionReceiptKind } from './money-production-commissioning.js'

type ReceiptRow=Readonly<{
  receipt_id:string
  lane:MoneyProductionLane
  kind:MoneyProductionReceiptKind
  provider:string
  environment:'PAPER'|'SHADOW'|'LIVE'
  passed:boolean
  recorded_at:string|Date
  evidence_ids:string[]
  issuer:'MONEY_CERTIFICATION'|'PROVIDER_RUNTIME'|'OPERATIONS'
}>

function safe(value:string){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))throw new Error('MONEY_PROD_RECEIPT_TABLE_INVALID');return value}
const iso=(v:string|Date)=>v instanceof Date?v.toISOString():new Date(v).toISOString()

function mapRow(row:ReceiptRow):MoneyProductionCommissioningReceipt{
  return Object.freeze({
    receiptId:row.receipt_id,lane:row.lane,kind:row.kind,provider:row.provider,environment:row.environment,passed:row.passed,
    recordedAt:iso(row.recorded_at),evidenceIds:Object.freeze(row.evidence_ids??[]),issuer:row.issuer,authority:'CERTIFICATION_ONLY',canExecute:false,
  })
}

export class PostgresMoneyProductionCommissioningStore{
  private readonly table:string
  constructor(private readonly client:SqlClient,tableName='money_production_commissioning_receipts'){this.table=safe(tableName)}
  async put(receipt:MoneyProductionCommissioningReceipt):Promise<void>{
    if(receipt.authority!=='CERTIFICATION_ONLY'||receipt.canExecute!==false)throw new Error('MONEY_PROD_RECEIPT_AUTHORITY_FORBIDDEN')
    const r=await this.client.query(
      `INSERT INTO ${this.table}(receipt_id,lane,kind,provider,environment,passed,recorded_at,evidence_ids,issuer)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT(receipt_id) DO NOTHING
       RETURNING receipt_id`,
      [receipt.receiptId,receipt.lane,receipt.kind,receipt.provider,receipt.environment,receipt.passed,receipt.recordedAt,[...receipt.evidenceIds],receipt.issuer],
    )
    if((r.rowCount??r.rows.length)!==1)throw new Error('MONEY_PROD_RECEIPT_EXISTS')
  }
  async get(receiptId:string):Promise<MoneyProductionCommissioningReceipt|undefined>{
    const r=await this.client.query<ReceiptRow>(`SELECT receipt_id,lane,kind,provider,environment,passed,recorded_at,evidence_ids,issuer FROM ${this.table} WHERE receipt_id=$1 LIMIT 1`,[receiptId])
    return r.rows[0]?mapRow(r.rows[0]):undefined
  }
  async listLane(lane:MoneyProductionLane):Promise<readonly MoneyProductionCommissioningReceipt[]>{
    const r=await this.client.query<ReceiptRow>(`SELECT receipt_id,lane,kind,provider,environment,passed,recorded_at,evidence_ids,issuer FROM ${this.table} WHERE lane=$1 ORDER BY recorded_at ASC,receipt_id ASC`,[lane])
    return Object.freeze(r.rows.map(mapRow))
  }
  async listAll():Promise<readonly MoneyProductionCommissioningReceipt[]>{
    const r=await this.client.query<ReceiptRow>(`SELECT receipt_id,lane,kind,provider,environment,passed,recorded_at,evidence_ids,issuer FROM ${this.table} ORDER BY recorded_at ASC,receipt_id ASC`)
    return Object.freeze(r.rows.map(mapRow))
  }
}
