import type { SqlClient } from './postgres-idempotency-store.js'
import type { AutonomousTradingMandate, AutonomousTradingMandateStore } from './autonomous-trading-contracts.js'

type Row={
  mandate_id:string;user_id:string;provider:string;account_id:string;currency:string;mode:'LIVE_AUTONOMOUS';
  allowed_instrument_prefixes:string[];allowed_strategy_ids:string[];allow_opening_shorts:boolean;
  max_order_notional_minor:string|number|bigint;max_daily_submitted_notional_minor:string|number|bigint;max_daily_orders:number;
  max_daily_realized_loss_minor:string|number|bigint;max_gross_exposure_minor:string|number|bigint;max_drawdown_bps:number;max_leverage_bps:number;min_model_confidence_bps:number;
  starts_at:string|Date;expires_at:string|Date;approval_receipt_id:string;action_core_authority_id:string;policy_version:string;policy_hash:string;
  evidence_ids:string[];status:AutonomousTradingMandate['status'];activated_at:string|Date;revoked_at:string|Date|null;
}
const safe=(x:string)=>{if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(x))throw new Error('MONEY_AUTO_MANDATE_TABLE_INVALID');return x}
const iso=(x:string|Date|null)=>x==null?undefined:x instanceof Date?x.toISOString():new Date(x).toISOString()
const map=(r:Row):AutonomousTradingMandate=>Object.freeze({
  mandateId:r.mandate_id,userId:r.user_id,provider:r.provider,accountId:r.account_id,currency:r.currency,mode:r.mode,
  allowedInstrumentPrefixes:Object.freeze(r.allowed_instrument_prefixes),allowedStrategyIds:Object.freeze(r.allowed_strategy_ids),allowOpeningShorts:r.allow_opening_shorts,
  limits:Object.freeze({maxOrderNotionalMinor:BigInt(r.max_order_notional_minor),maxDailySubmittedNotionalMinor:BigInt(r.max_daily_submitted_notional_minor),maxDailyOrders:r.max_daily_orders,maxDailyRealizedLossMinor:BigInt(r.max_daily_realized_loss_minor),maxGrossExposureMinor:BigInt(r.max_gross_exposure_minor),maxDrawdownBps:r.max_drawdown_bps,maxLeverageBps:r.max_leverage_bps,minModelConfidenceBps:r.min_model_confidence_bps}),
  startsAt:iso(r.starts_at)!,expiresAt:iso(r.expires_at)!,approvalReceiptId:r.approval_receipt_id,actionCoreAuthorityId:r.action_core_authority_id,policyVersion:r.policy_version,policyHash:r.policy_hash,
  evidenceIds:Object.freeze(r.evidence_ids),status:r.status,activatedAt:iso(r.activated_at)!,revokedAt:iso(r.revoked_at),authority:'USER_APPROVED_MANDATE',canAuthorizeTrade:false,
})
export class PostgresAutonomousTradingMandateStore implements AutonomousTradingMandateStore{
  private table:string
  constructor(private client:SqlClient,tableName='money_autonomous_trading_mandates'){this.table=safe(tableName)}
  async put(m:AutonomousTradingMandate){await this.client.query(
    `INSERT INTO ${this.table}(mandate_id,user_id,provider,account_id,currency,mode,allowed_instrument_prefixes,allowed_strategy_ids,allow_opening_shorts,max_order_notional_minor,max_daily_submitted_notional_minor,max_daily_orders,max_daily_realized_loss_minor,max_gross_exposure_minor,max_drawdown_bps,max_leverage_bps,min_model_confidence_bps,starts_at,expires_at,approval_receipt_id,action_core_authority_id,policy_version,policy_hash,evidence_ids,status,activated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
    [m.mandateId,m.userId,m.provider,m.accountId,m.currency,m.mode,[...m.allowedInstrumentPrefixes],[...m.allowedStrategyIds],m.allowOpeningShorts,m.limits.maxOrderNotionalMinor.toString(),m.limits.maxDailySubmittedNotionalMinor.toString(),m.limits.maxDailyOrders,m.limits.maxDailyRealizedLossMinor.toString(),m.limits.maxGrossExposureMinor.toString(),m.limits.maxDrawdownBps,m.limits.maxLeverageBps,m.limits.minModelConfidenceBps,m.startsAt,m.expiresAt,m.approvalReceiptId,m.actionCoreAuthorityId,m.policyVersion,m.policyHash,[...m.evidenceIds],m.status,m.activatedAt])}
  async get(id:string){const r=await this.client.query<Row>(`SELECT * FROM ${this.table} WHERE mandate_id=$1 LIMIT 1`,[id]);return r.rows[0]?map(r.rows[0]):undefined}
  async findActive(i:{userId:string;provider:string;accountId:string;now:string}){const r=await this.client.query<Row>(`SELECT * FROM ${this.table} WHERE user_id=$1 AND provider=$2 AND account_id=$3 AND status='ACTIVE' AND starts_at<=$4::timestamptz AND expires_at>$4::timestamptz ORDER BY activated_at DESC LIMIT 1`,[i.userId,i.provider,i.accountId,i.now]);return r.rows[0]?map(r.rows[0]):undefined}
  async revoke(id:string,revokedAt:string){const r=await this.client.query(`UPDATE ${this.table} SET status='REVOKED',revoked_at=$2 WHERE mandate_id=$1 AND status='ACTIVE'`,[id,revokedAt]);if((r.rowCount??0)!==1)throw new Error('MONEY_AUTO_MANDATE_NOT_ACTIVE')}
}
