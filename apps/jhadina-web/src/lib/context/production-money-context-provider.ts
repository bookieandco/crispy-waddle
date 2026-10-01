import {
  AlpacaStockMarketDataClient,
  evaluateStockAlert,
  evaluateStockSmaBaseline,
  type AlpacaStockObservationBundle,
  type PaperLearningEvent,
  type StrategyCalibration,
} from "@jhadina/money-core"
import {
  makeItMakeSense,
  type EvidenceRef,
  type MoneyDomainContext,
} from "@jhadina/core-spine"
import type { MoneyContextProvider } from "./context-builder"
import { createServiceRoleClient } from "../supabase/service-role"
import { resolveAlpacaPaperCredentials } from "../money/alpaca-paper-credentials"
import { SupabaseMoneyPaperRuntimeRepository } from "../money/paper-runtime-repository"

const COMMON_NON_TICKERS=new Set(["I","A","AI","CEO","USD","ETF","ETFS","THE","AND","OR","BUY","SELL","HOLD","IPO","SEC","FED","US","USA"])
const COMPANY_ALIASES:Readonly<Record<string,string>>=Object.freeze({
  apple:"AAPL",tesla:"TSLA",nvidia:"NVDA",microsoft:"MSFT",amazon:"AMZN",
  meta:"META",facebook:"META",google:"GOOGL",alphabet:"GOOGL",netflix:"NFLX",
  spotify:"SPOT",amd:"AMD",
})

function ref(id:string,source:string,observedAt:string,summary:string):EvidenceRef{
  return {id,source,observedAt,summary,immutable:true}
}

export function extractStockSymbols(activeTask:string):readonly string[]{
  const found:string[]=[]
  const add=(raw:string|undefined)=>{
    if(!raw)return
    const symbol=raw.toUpperCase()
    if(!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)||COMMON_NON_TICKERS.has(symbol)||found.includes(symbol))return
    found.push(symbol)
  }
  for(const match of activeTask.matchAll(/\$([A-Za-z][A-Za-z0-9.\-]{0,9})\b/g))add(match[1])
  for(const match of activeTask.matchAll(/\bstock:([A-Za-z][A-Za-z0-9.\-]{0,9})\b/gi))add(match[1])
  for(const match of activeTask.matchAll(/\bticker\s+([A-Za-z][A-Za-z0-9.\-]{0,9})\b/gi))add(match[1])
  for(const token of activeTask.match(/\b[A-Z][A-Z0-9.\-]{1,9}\b/g)??[])add(token)
  const lower=activeTask.toLowerCase()
  for(const [name,symbol] of Object.entries(COMPANY_ALIASES))if(new RegExp("\\b"+name+"\\b","i").test(lower))add(symbol)
  return Object.freeze(found.slice(0,3))
}

function moneyRelevant(activeTask:string):boolean{
  return /\b(stock|stocks|ticker|market|trading|trade|paper|watchlist|alert|portfolio|position|strategy|shares|equity|buy|sell|hold|options?|forex|money core)\b/i.test(activeTask)
    ||extractStockSymbols(activeTask).length>0
}

function priorDayWindow(now:string):{start:string;end:string}{
  const nowMs=Date.parse(now)
  const endMs=nowMs-24*60*60*1000
  return {
    start:new Date(endMs-180*24*60*60*1000).toISOString(),
    end:new Date(endMs).toISOString(),
  }
}

function latestCalibration(events:readonly PaperLearningEvent[],strategyId:string):StrategyCalibration|undefined{
  for(const event of events){
    if(event.kind!=="CALIBRATION"||event.strategyId!==strategyId)continue
    const payload=event.payload as Partial<StrategyCalibration>
    if(payload.strategyId===strategyId&&typeof payload.status==="string")return event.payload as StrategyCalibration
  }
  return undefined
}

function marketSummary(bundle:AlpacaStockObservationBundle):string{
  const last=bundle.dailyBars.at(-1)
  const q=bundle.quote
  return [
    bundle.symbol,
    q?("bid "+q.bidPrice+" / ask "+q.askPrice):"current quote unavailable",
    last?("last completed daily close "+last.close):"daily close unavailable",
    "feed="+bundle.feed,
  ].join("; ")
}

export function createProductionMoneyContextProvider(
  options:Readonly<{
    now?:()=>string
    createClient?:()=>ReturnType<typeof createServiceRoleClient>
    createMarketClient?:(credentials:{keyId:string;secretKey:string})=>AlpacaStockMarketDataClient
  }>={},
):MoneyContextProvider{
  return {
    async getContext({userId,activeTask}):Promise<MoneyDomainContext|undefined>{
      if(!moneyRelevant(activeTask))return undefined
      const now=(options.now??(()=>new Date().toISOString()))()
      const client=(options.createClient??createServiceRoleClient)()
      const limitations:string[]=[
        "Money context is read-only intelligence. It cannot place, approve, or authorize a live trade.",
        "Paper results, MIMS votes, strategy calibration, and market observations are evidence inputs, not guarantees or personalized return promises.",
      ]
      if(!client){
        return {market:[],watchlist:[],paperActivity:[],learning:[],alerts:[],attention:[],uncertainty:["Durable Money storage is unavailable."],limitations,provenance:[]}
      }

      const repo=new SupabaseMoneyPaperRuntimeRepository(client)
      const [watchlist,learningEvents]=await Promise.all([
        repo.listWatchlist(userId).catch(()=>[]),
        repo.listLearning(userId,100).catch(()=>[]),
      ])
      const watchRefs=watchlist.map((entry)=>ref(
        entry.entryId,"money:watchlist",entry.updatedAt,
        entry.symbol+" is on the user's Money watchlist.",
      ))
      const paperActivity=learningEvents
        .filter((event)=>event.kind==="DECISION"||event.kind==="AUTOPILOT")
        .slice(0,10)
        .map((event)=>ref(
          event.eventId,"money:paper-learning",event.occurredAt,
          event.kind+" record"+(event.instrumentId?(" for "+event.instrumentId):"")+(event.strategyId?(" using "+event.strategyId):"")+".",
        ))
      const learningRefs=learningEvents
        .filter((event)=>["DECISION_LEARNING","STRATEGY_LEARNING","CALIBRATION","REVIEW"].includes(event.kind))
        .slice(0,10)
        .map((event)=>ref(
          event.eventId,"money:paper-learning",event.occurredAt,
          event.kind+(event.strategyId?(" for "+event.strategyId):"")+"; authority is learning/review only.",
        ))

      const explicit=extractStockSymbols(activeTask)
      const symbols=explicit.length?explicit:watchlist.slice(0,3).map((entry)=>entry.symbol)
      const marketRefs:EvidenceRef[]=[]
      const alertRefs:EvidenceRef[]=[]
      const attention:EvidenceRef[]=[]
      const provenance:EvidenceRef[]=[]
      const uncertainty:string[]=[]

      if(symbols.length){
        let credentials:{keyId:string;secretKey:string}|undefined
        try{credentials=await resolveAlpacaPaperCredentials()}catch{
          limitations.push("Alpaca paper credentials are not configured, so live market observations were omitted.")
        }
        if(credentials){
          const marketClient=options.createMarketClient?.(credentials)??new AlpacaStockMarketDataClient({credentials:()=>credentials!})
          const window=priorDayWindow(now)
          for(const symbol of symbols){
            try{
              const bundle=await marketClient.getStockBundle({symbol,start:window.start,end:window.end,now,feed:"iex",maxBars:90})
              marketRefs.push(ref(
                "money-market:"+bundle.provenanceHash,"alpaca-market-data",now,marketSummary(bundle),
              ))
              for(const evidenceId of bundle.evidenceIds.slice(-5)){
                provenance.push(ref(evidenceId,"alpaca-market-data",now,"Market evidence for "+symbol+"."))
              }

              if(bundle.dailyBars.length>=51){
                const baseline=evaluateStockSmaBaseline(bundle.dailyBars)
                const calibration=latestCalibration(learningEvents,baseline.strategyId)
                const mims=makeItMakeSense({
                  voteId:"mims:"+baseline.decisionId,
                  subjectId:baseline.decisionId,
                  checks:[
                    {dimension:"EVIDENCE",status:"PASS",rationale:"The baseline is computed from provider-stamped daily bars.",evidenceRefs:baseline.evidenceIds},
                    {dimension:"CHRONOLOGY",status:"PASS",rationale:"Only bars available before the baseline information cutoff are used.",evidenceRefs:baseline.evidenceIds},
                    {dimension:"CAUSAL_LOGIC",status:"PASS",rationale:"The 20/50 crossover is treated as a statistical control signal, not a causal claim.",evidenceRefs:baseline.evidenceIds},
                    {dimension:"INCENTIVES",status:"NOT_APPLICABLE",rationale:"The deterministic price crossover makes no actor-incentive claim.",evidenceRefs:[]},
                    {dimension:"BASE_RATES",status:calibration?.status==="SIMULATION_SUPPORTED"?"PASS":"REVIEW",rationale:calibration?("Paper calibration status is "+calibration.status+" with sample size "+calibration.sampleSize+"."):"No supported paper calibration is available yet.",evidenceRefs:calibration?.learningRecordIds??baseline.evidenceIds},
                    {dimension:"CONTRADICTIONS",status:"PASS",rationale:"The control strategy evaluates both upward and downward crossovers and can emit HOLD.",evidenceRefs:baseline.evidenceIds},
                    {dimension:"ALTERNATIVES",status:"PASS",rationale:"HOLD and EXIT remain explicit alternatives to a long entry.",evidenceRefs:baseline.evidenceIds},
                  ],
                })
                marketRefs.push(ref(
                  baseline.decisionId,"money:baseline",baseline.informationCutoff,
                  symbol+" 20/50 baseline="+baseline.signal+"; fast="+baseline.currentFast.toFixed(2)+", slow="+baseline.currentSlow.toFixed(2)+"; MIMS="+mims.status+"; calibration="+(calibration?.status??"INSUFFICIENT_EVIDENCE")+".",
                ))
                if(mims.status!=="PASS")attention.push(ref(
                  mims.voteId,"jhadina:mims",now,
                  symbol+" baseline requires "+mims.status.toLowerCase()+" before stronger confidence; coherent does not mean true.",
                ))
              } else {
                uncertainty.push(symbol+": fewer than 51 completed daily bars were available for the baseline.")
              }

              if(bundle.quote){
                const rules=await repo.listAlerts(userId,symbol).catch(()=>[])
                for(const rule of rules){
                  const evaluation=evaluateStockAlert(rule,bundle.quote)
                  const alertRef=ref(
                    "stock-alert-eval:"+rule.alertId+":"+bundle.quote.quoteId,"money:stock-alert",evaluation.observedAt,
                    evaluation.triggered?(evaluation.message??(symbol+" alert triggered.")):(symbol+" alert "+rule.alertId+" is not triggered."),
                  )
                  alertRefs.push(alertRef)
                  if(evaluation.triggered)attention.push(alertRef)
                }
              }
            }catch(error){
              uncertainty.push(symbol+": market context unavailable ("+String(error).slice(0,180)+").")
            }
          }
        }
      }

      return {
        market:marketRefs,
        watchlist:watchRefs,
        paperActivity,
        learning:learningRefs,
        alerts:alertRefs,
        attention,
        uncertainty,
        limitations,
        provenance,
      }
    },
  }
}
