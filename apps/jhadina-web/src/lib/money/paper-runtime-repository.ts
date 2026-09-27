import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertPaperLearningEvent,
  createPaperAutopilotSettings,
  createStockAlertRule,
  createStockWatchlistEntry,
  decodePaperLearningPayload,
  encodePaperLearningPayload,
  type PaperAutopilotSettings,
  type PaperLearningEvent,
  type StockAlertRule,
  type StockWatchlistEntry,
} from "@jhadina/money-core"

type SettingsRow = {
  user_id:string
  provider:"alpaca"
  account_id:string
  mode:PaperAutopilotSettings["mode"]
  stock_feed:PaperAutopilotSettings["stockFeed"]
  strategy_id:string
  base_order_notional_minor:string|number
  max_order_notional_minor:string|number
  maximum_concurrent_positions:number
  stop_loss_bps:number
  take_profit_bps:number
  updated_at:string
  evidence_ids:string[]
}
type WatchRow = {
  user_id:string;symbol:string;enabled:boolean;added_at:string;updated_at:string;evidence_ids:string[]
}
type AlertRow = {
  alert_id:string;user_id:string;symbol:string;condition:StockAlertRule["condition"];threshold:number|string;reference_price:number|string|null;enabled:boolean;repeat:boolean;created_at:string;updated_at:string;evidence_ids:string[]
}
type LearningRow = {
  event_id:string;user_id:string;paper_run_id:string|null;strategy_id:string|null;instrument_id:string|null;kind:PaperLearningEvent["kind"];occurred_at:string;payload_json:unknown;payload_hash:string;evidence_ids:string[]
}

export class SupabaseMoneyPaperRuntimeRepository {
  constructor(private readonly client:SupabaseClient) {}

  async getSettings(userId:string,accountId:string):Promise<PaperAutopilotSettings|undefined>{
    const {data,error}=await this.client
      .from("money_paper_autopilot_settings")
      .select("*")
      .eq("user_id",userId)
      .eq("provider","alpaca")
      .eq("account_id",accountId)
      .maybeSingle()
    if(error)throw new Error("MONEY_PAPER_SETTINGS_READ_FAILED:"+error.message)
    if(!data)return undefined
    const row=data as SettingsRow
    return createPaperAutopilotSettings({
      userId:row.user_id,
      accountId:row.account_id,
      mode:row.mode,
      stockFeed:row.stock_feed,
      strategyId:row.strategy_id,
      baseOrderNotionalMinor:String(row.base_order_notional_minor),
      maxOrderNotionalMinor:String(row.max_order_notional_minor),
      maximumConcurrentPositions:row.maximum_concurrent_positions,
      stopLossBps:row.stop_loss_bps,
      takeProfitBps:row.take_profit_bps,
      updatedAt:row.updated_at,
      evidenceIds:row.evidence_ids??[],
    })
  }

  async listActiveSettings():Promise<readonly PaperAutopilotSettings[]>{
    const {data,error}=await this.client
      .from("money_paper_autopilot_settings")
      .select("*")
      .in("mode",["OBSERVE","ADVISE","PAPER_AUTO_REDUCED","PAPER_AUTO"])
      .order("updated_at",{ascending:true})
    if(error)throw new Error("MONEY_PAPER_SETTINGS_LIST_FAILED:"+error.message)
    return Object.freeze((data??[]).map((raw)=>{
      const row=raw as SettingsRow
      return createPaperAutopilotSettings({
        userId:row.user_id,
        accountId:row.account_id,
        mode:row.mode,
        stockFeed:row.stock_feed,
        strategyId:row.strategy_id,
        baseOrderNotionalMinor:String(row.base_order_notional_minor),
        maxOrderNotionalMinor:String(row.max_order_notional_minor),
        maximumConcurrentPositions:row.maximum_concurrent_positions,
      stopLossBps:row.stop_loss_bps,
      takeProfitBps:row.take_profit_bps,
        updatedAt:row.updated_at,
        evidenceIds:row.evidence_ids??[],
      })
    }))
  }

  async putSettings(settings:PaperAutopilotSettings):Promise<void>{
    const {error}=await this.client.from("money_paper_autopilot_settings").upsert({
      user_id:settings.userId,
      provider:settings.provider,
      account_id:settings.accountId,
      mode:settings.mode,
      stock_feed:settings.stockFeed,
      strategy_id:settings.strategyId,
      base_order_notional_minor:settings.baseOrderNotionalMinor,
      max_order_notional_minor:settings.maxOrderNotionalMinor,
      maximum_concurrent_positions:settings.maximumConcurrentPositions,
      stop_loss_bps:settings.stopLossBps,
      take_profit_bps:settings.takeProfitBps,
      allow_opening_shorts:false,
      updated_at:settings.updatedAt,
      evidence_ids:[...settings.evidenceIds],
    },{onConflict:"user_id,provider,account_id"})
    if(error)throw new Error("MONEY_PAPER_SETTINGS_WRITE_FAILED:"+error.message)
  }

  async listWatchlist(userId:string):Promise<readonly StockWatchlistEntry[]>{
    const {data,error}=await this.client
      .from("money_stock_watchlist_entries")
      .select("*")
      .eq("user_id",userId)
      .eq("enabled",true)
      .order("symbol",{ascending:true})
    if(error)throw new Error("MONEY_STOCK_WATCHLIST_READ_FAILED:"+error.message)
    return Object.freeze((data??[]).map((raw)=>{
      const row=raw as WatchRow
      return createStockWatchlistEntry({
        userId:row.user_id,
        symbol:row.symbol,
        enabled:row.enabled,
        addedAt:row.added_at,
        updatedAt:row.updated_at,
        evidenceIds:row.evidence_ids??[],
      })
    }))
  }

  async putWatchlistEntry(entry:StockWatchlistEntry):Promise<void>{
    const {error}=await this.client.from("money_stock_watchlist_entries").upsert({
      entry_id:entry.entryId,
      user_id:entry.userId,
      symbol:entry.symbol,
      enabled:entry.enabled,
      added_at:entry.addedAt,
      updated_at:entry.updatedAt,
      evidence_ids:[...entry.evidenceIds],
    },{onConflict:"user_id,symbol"})
    if(error)throw new Error("MONEY_STOCK_WATCHLIST_WRITE_FAILED:"+error.message)
  }

  async removeWatchlistEntry(userId:string,symbol:string):Promise<void>{
    const {error}=await this.client
      .from("money_stock_watchlist_entries")
      .delete()
      .eq("user_id",userId)
      .eq("symbol",symbol.toUpperCase())
    if(error)throw new Error("MONEY_STOCK_WATCHLIST_DELETE_FAILED:"+error.message)
  }

  async listAlerts(userId:string,symbol?:string):Promise<readonly StockAlertRule[]>{
    let query=this.client.from("money_stock_alerts").select("*").eq("user_id",userId).eq("enabled",true)
    if(symbol)query=query.eq("symbol",symbol.toUpperCase())
    const {data,error}=await query.order("symbol",{ascending:true})
    if(error)throw new Error("MONEY_STOCK_ALERT_READ_FAILED:"+error.message)
    return Object.freeze((data??[]).map((raw)=>{
      const row=raw as AlertRow
      return createStockAlertRule({
        alertId:row.alert_id,userId:row.user_id,symbol:row.symbol,condition:row.condition,
        threshold:Number(row.threshold),referencePrice:row.reference_price==null?undefined:Number(row.reference_price),
        enabled:row.enabled,repeat:row.repeat,createdAt:row.created_at,updatedAt:row.updated_at,evidenceIds:row.evidence_ids??[],
      })
    }))
  }

  async appendLearningEvent(event:PaperLearningEvent):Promise<"INSERTED"|"REPLAY">{
    assertPaperLearningEvent(event)
    const payload=JSON.parse(encodePaperLearningPayload(event.payload))
    const {data,error}=await this.client.from("money_paper_learning_events").insert({
      event_id:event.eventId,user_id:event.userId,paper_run_id:event.paperRunId??null,strategy_id:event.strategyId??null,
      instrument_id:event.instrumentId??null,kind:event.kind,occurred_at:event.occurredAt,payload_json:payload,payload_hash:event.payloadHash,
      evidence_ids:[...event.evidenceIds],
    }).select("event_id").maybeSingle()
    if(!error&&data)return "INSERTED"
    if(error?.code!=="23505")throw new Error("MONEY_PAPER_LEARNING_WRITE_FAILED:"+(error?.message??"unknown"))

    const {data:existing,error:readError}=await this.client
      .from("money_paper_learning_events").select("payload_hash").eq("event_id",event.eventId).maybeSingle()
    if(readError||!existing)throw new Error("MONEY_PAPER_LEARNING_REPLAY_READ_FAILED:"+(readError?.message??"missing"))
    if(String((existing as {payload_hash:string}).payload_hash)!==event.payloadHash)throw new Error("MONEY_PAPER_LEARNING_EVENT_CONFLICT")
    return "REPLAY"
  }

  async listLearning(userId:string,limit=100):Promise<readonly PaperLearningEvent[]>{
    const bounded=Math.max(1,Math.min(500,Math.trunc(limit)))
    const {data,error}=await this.client
      .from("money_paper_learning_events")
      .select("*")
      .eq("user_id",userId)
      .order("occurred_at",{ascending:false})
      .limit(bounded)
    if(error)throw new Error("MONEY_PAPER_LEARNING_READ_FAILED:"+error.message)
    return Object.freeze((data??[]).map((raw)=>{
      const row=raw as LearningRow
      const event:PaperLearningEvent=Object.freeze({
        eventId:row.event_id,userId:row.user_id,paperRunId:row.paper_run_id??undefined,strategyId:row.strategy_id??undefined,
        instrumentId:row.instrument_id??undefined,kind:row.kind,occurredAt:row.occurred_at,payload:decodePaperLearningPayload(row.payload_json),
        payloadHash:row.payload_hash,evidenceIds:Object.freeze([...(row.evidence_ids??[])]),authority:"LEARNING_RECORD_ONLY" as const,canAuthorizeLive:false as const,
      })
      assertPaperLearningEvent(event)
      return event
    }))
  }

  async hasActivePaperEntitlement(userId:string,accountId:string,now:string):Promise<boolean>{
    const {data,error}=await this.client
      .from("money_broker_account_entitlements")
      .select("entitlement_id,capabilities,evidence_ids,expires_at")
      .eq("user_id",userId)
      .eq("provider","alpaca")
      .eq("account_id",accountId)
      .eq("status","ACTIVE")
      .contains("capabilities",["money.paper.trade.submit"])
      .limit(1)
    if(error)throw new Error("MONEY_PAPER_ENTITLEMENT_READ_FAILED:"+error.message)
    const row=(data??[])[0] as {expires_at?:string|null}|undefined
    return Boolean(row&&(!row.expires_at||row.expires_at>now))
  }
}
