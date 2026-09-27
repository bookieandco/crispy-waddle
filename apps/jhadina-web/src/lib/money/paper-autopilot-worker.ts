import {
  AlpacaStockMarketDataClient,
  createAlpacaPaperBrokerAdapter,
  createPaperDecision,
  createPaperLearningEvent,
  createPaperRealismProfile,
  assessPaperRealism,
  evaluatePaperAutopilot,
  evaluateStockSmaBaseline,
  type PaperLearningEvent,
  type StrategyCalibration,
} from "@jhadina/money-core"
import { makeItMakeSense } from "@jhadina/core-spine"
import { createServiceRoleClient } from "../supabase/service-role"
import { resolveAlpacaPaperCredentials } from "./alpaca-paper-credentials"
import { SupabaseMoneyPaperRuntimeRepository } from "./paper-runtime-repository"

function priorDayWindow(now:string){
  const nowMs=Date.parse(now)
  const endMs=nowMs-24*60*60*1000
  return {start:new Date(endMs-180*24*60*60*1000).toISOString(),end:new Date(endMs).toISOString()}
}
function latestCalibration(events:readonly PaperLearningEvent[],strategyId:string):StrategyCalibration|undefined{
  for(const event of events){
    if(event.kind!=="CALIBRATION"||event.strategyId!==strategyId)continue
    const payload=event.payload as Partial<StrategyCalibration>
    if(payload.strategyId===strategyId&&typeof payload.status==="string")return event.payload as StrategyCalibration
  }
  return undefined
}
function positiveMinorFromPrice(value:string):bigint{
  if(!/^\d+(\.\d+)?$/.test(value))throw new Error("MONEY_PAPER_WORKER_PRICE_INVALID")
  const [w,f=""]=value.split(".")
  return BigInt(w!)*100n+BigInt((f+"00").slice(0,2))
}
function scaled(base:string,multiplierBps:number,max:string,buyingPower:bigint):bigint{
  const v=BigInt(base)*BigInt(multiplierBps)/10000n
  return [v,BigInt(max),buyingPower].reduce((a,b)=>a<b?a:b)
}
function mimsForBaseline(input:Readonly<{
  decisionId:string
  evidenceIds:readonly string[]
  calibration?:StrategyCalibration
}>){
  return makeItMakeSense({
    voteId:"mims:"+input.decisionId,
    subjectId:input.decisionId,
    checks:[
      {dimension:"EVIDENCE",status:"PASS",rationale:"The signal is computed from provider-stamped completed daily bars.",evidenceRefs:input.evidenceIds},
      {dimension:"CHRONOLOGY",status:"PASS",rationale:"Only observations available by the completed-bar cutoff are used.",evidenceRefs:input.evidenceIds},
      {dimension:"CAUSAL_LOGIC",status:"PASS",rationale:"The moving-average crossover is a control heuristic, not a causal claim.",evidenceRefs:input.evidenceIds},
      {dimension:"INCENTIVES",status:"NOT_APPLICABLE",rationale:"This deterministic price control makes no actor-incentive claim.",evidenceRefs:[]},
      {dimension:"BASE_RATES",status:input.calibration?.status==="SIMULATION_SUPPORTED"?"PASS":"REVIEW",rationale:input.calibration?("Calibration status="+input.calibration.status+", samples="+input.calibration.sampleSize):"No supported calibration exists yet; reduced paper exploration may collect samples.",evidenceRefs:input.calibration?.learningRecordIds??input.evidenceIds},
      {dimension:"CONTRADICTIONS",status:"PASS",rationale:"The control can enter, exit, or hold; opposing outcomes are represented.",evidenceRefs:input.evidenceIds},
      {dimension:"ALTERNATIVES",status:"PASS",rationale:"HOLD and EXIT remain explicit alternatives to entry.",evidenceRefs:input.evidenceIds},
    ],
  })
}
function positionQuantity(value:string):number{
  const n=Number(value)
  return Number.isFinite(n)?n:0
}

export type PaperAutopilotCycleReceipt=Readonly<{
  ranAt:string
  settingsProcessed:number
  symbolsProcessed:number
  decisionsInserted:number
  decisionsReplayed:number
  paperOrdersSubmitted:number
  paperOrdersSkipped:number
  errors:readonly string[]
  canAuthorizeLive:false
}>

export async function runMoneyPaperAutopilotCycle(
  options:Readonly<{now?:string}>={},
):Promise<PaperAutopilotCycleReceipt>{
  const ranAt=options.now??new Date().toISOString()
  const client=createServiceRoleClient()
  if(!client)throw new Error("MONEY_PAPER_WORKER_STORAGE_UNAVAILABLE")
  const repo=new SupabaseMoneyPaperRuntimeRepository(client)
  const credentials=await resolveAlpacaPaperCredentials()
  const market=new AlpacaStockMarketDataClient({credentials:()=>credentials})
  const broker=createAlpacaPaperBrokerAdapter({credentials:()=>credentials})
  const settingsRows=await repo.listActiveSettings()

  let symbolsProcessed=0,decisionsInserted=0,decisionsReplayed=0,paperOrdersSubmitted=0,paperOrdersSkipped=0
  const errors:string[]=[]

  for(const settings of settingsRows){
    try{
      const entitled=await repo.hasActivePaperEntitlement(settings.userId,settings.accountId,ranAt)
      if(!entitled){errors.push(settings.accountId+": missing active paper entitlement");continue}
      const [watchlist,learning,account,positions]=await Promise.all([
        repo.listWatchlist(settings.userId),
        repo.listLearning(settings.userId,300),
        broker.getAccount(settings.accountId,ranAt),
        broker.listPositions(settings.accountId,ranAt),
      ])
      const positionMap=new Map(positions.map((p)=>[p.instrumentId,p]))
      const profile=createPaperRealismProfile({
        profileId:"paper:"+settings.userId+":"+settings.accountId,
        startingEquityMinor:account.cashMinor+positions.reduce((n,p)=>n+(p.marketValueMinor??0n),0n),
        currency:account.currency,
        leverageBps:10000,
        marginEnabled:false,
        slippageBps:5,
        requireProtectiveExitPlan:true,
        maximumRiskPerTradeBps:Math.min(settings.stopLossBps,1000),
        warmupExecutionCount:10,
      })
      const window=priorDayWindow(ranAt)

      for(const entry of watchlist){
        symbolsProcessed++
        try{
          if(settings.strategyId!=="stock-baseline-sma-20-50"){paperOrdersSkipped++;errors.push(entry.symbol+": unsupported paper strategy "+settings.strategyId);continue}
          const bundle=await market.getStockBundle({symbol:entry.symbol,start:window.start,end:window.end,now:ranAt,feed:settings.stockFeed,maxBars:90})
          if(!bundle.quote||bundle.dailyBars.length<51){paperOrdersSkipped++;continue}
          const baseline=evaluateStockSmaBaseline(bundle.dailyBars)
          const calibration=latestCalibration(learning,baseline.strategyId)
          const mims=mimsForBaseline({decisionId:baseline.decisionId,evidenceIds:baseline.evidenceIds,calibration})
          const current=positionMap.get(baseline.instrumentId)
          const hasLong=Boolean(current&&positionQuantity(current.quantity)>0)

          let action:"PAPER_TRADE"|"NO_TRADE"="NO_TRADE"
          let side:"BUY"|"SELL"|undefined
          const reasons:string[]=[]
          if(baseline.signal==="LONG_ENTRY"&&!hasLong){action="PAPER_TRADE";side="BUY";reasons.push("BASELINE_LONG_ENTRY")}
          else if(baseline.signal==="EXIT"&&hasLong){action="PAPER_TRADE";side="SELL";reasons.push("BASELINE_RISK_REDUCING_EXIT")}
          else if(baseline.signal==="LONG_ENTRY"&&hasLong)reasons.push("ALREADY_LONG")
          else if(baseline.signal==="EXIT"&&!hasLong)reasons.push("NO_LONG_POSITION_TO_EXIT")
          else reasons.push("NO_SIGNAL")

          const paperRunId="paper-daily:"+settings.accountId+":"+baseline.informationCutoff.slice(0,10)
          const decision=createPaperDecision({
            decisionId:"paper-decision:"+settings.userId+":"+settings.accountId+":"+baseline.decisionId,
            paperRunId,accountId:settings.accountId,instrumentId:baseline.instrumentId,
            strategyId:baseline.strategyId,scenarioId:"daily:"+entry.symbol,action,side,signal:baseline.signal,
            reasonCodes:reasons,informationCutoff:baseline.informationCutoff,createdAt:ranAt,
            evidenceIds:Object.freeze([...new Set([...baseline.evidenceIds,bundle.provenanceHash,...settings.evidenceIds])]),
          })
          const decisionEvent=createPaperLearningEvent({
            userId:settings.userId,kind:"DECISION",occurredAt:baseline.informationCutoff,payload:decision,
            paperRunId,strategyId:baseline.strategyId,instrumentId:baseline.instrumentId,
          })
          const append=await repo.appendLearningEvent(decisionEvent)
          if(append==="INSERTED")decisionsInserted++;else decisionsReplayed++

          const requestedBase=action==="PAPER_TRADE"&&side==="SELL"&&current
            ? (current.marketValueMinor<0n?-current.marketValueMinor:current.marketValueMinor).toString()
            : settings.baseOrderNotionalMinor
          const quotePrice=side==="SELL"?positiveMinorFromPrice(bundle.quote.bidPrice):positiveMinorFromPrice(bundle.quote.askPrice)
          const draftNotional=scaled(requestedBase,settings.mode==="PAPER_AUTO_REDUCED"?2500:10000,settings.maxOrderNotionalMinor,account.buyingPowerMinor)
          const maxLoss=draftNotional*BigInt(settings.stopLossBps)/10000n
          const realism=assessPaperRealism({
            profile,currentEquityMinor:profile.startingEquityMinor,requestedNotionalMinor:draftNotional,
            plannedMaximumLossMinor:maxLoss,hasProtectiveExitPlan:action==="NO_TRADE"||side==="SELL"||settings.stopLossBps>0,
          })
          const maxPositionBlocked=side==="BUY"&&!hasLong&&positions.length>=settings.maximumConcurrentPositions
          const hardRiskStatus=realism.status==="FAIL"||maxPositionBlocked||draftNotional<=0n?"FAIL":realism.status
          const autopilot=evaluatePaperAutopilot({
            mode:settings.mode,accountEnvironment:"PAPER",signal:baseline.signal,mimsStatus:mims.status,
            mimsReviewExplorationAllowed:true,hardRiskStatus,behavioralRiskStatus:"PASS",
            providerHealth:"HEALTHY",unresolvedExecutionCount:0,calibration,
          })
          const autopilotEvent=createPaperLearningEvent({
            userId:settings.userId,kind:"AUTOPILOT",occurredAt:ranAt,payload:autopilot,
            paperRunId,strategyId:baseline.strategyId,instrumentId:baseline.instrumentId,
            evidenceIds:[decisionEvent.eventId,mims.voteId],
          })
          await repo.appendLearningEvent(autopilotEvent)

          if(action!=="PAPER_TRADE"||autopilot.disposition!=="PAPER_TRADE_ELIGIBLE"||append!=="INSERTED"){
            paperOrdersSkipped++;continue
          }

          const notional=scaled(requestedBase,autopilot.notionalMultiplierBps,settings.maxOrderNotionalMinor,account.buyingPowerMinor)
          if(notional<=0n){paperOrdersSkipped++;continue}
          const stop=side==="BUY"
            ? quotePrice*(10000n-BigInt(settings.stopLossBps))/10000n
            : undefined
          const take=side==="BUY"
            ? quotePrice*(10000n+BigInt(settings.takeProfitBps))/10000n
            : undefined

          await broker.submitPaperOrder(
            {
              environment:"PAPER",executionId:"paper-exec:"+decision.decisionId,idempotencyKey:decision.decisionId,
              userId:settings.userId,paperRunId,paperDecisionId:decision.decisionId,now:ranAt,autopilot,
            },
            {
              clientOrderId:decision.decisionId.slice(0,48),accountId:settings.accountId,instrumentId:baseline.instrumentId,
              side:side!,orderType:"LIMIT",notionalMinor:notional.toString(),limitPriceMinor:quotePrice.toString(),
              currency:"USD",timeInForce:"DAY",
              ...(side==="BUY"?{takeProfitPriceMinor:take!.toString(),stopLossPriceMinor:stop!.toString()}:{})
            },
          )
          paperOrdersSubmitted++
        }catch(error){errors.push(entry.symbol+": "+String(error).slice(0,300))}
      }
    }catch(error){errors.push(settings.accountId+": "+String(error).slice(0,300))}
  }

  return Object.freeze({
    ranAt,settingsProcessed:settingsRows.length,symbolsProcessed,decisionsInserted,decisionsReplayed,
    paperOrdersSubmitted,paperOrdersSkipped,errors:Object.freeze(errors),canAuthorizeLive:false,
  })
}
