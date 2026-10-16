/**
 * MEME-PROFIT.11–.14: source-timestamped paper-only strategy scorecard.
 * Each snapshot is an INDEPENDENT counterfactual, never a fill or backtest of
 * actual execution. Summaries cannot be promoted to realized Money Core P&L.
 */
import {
  simulateDisclosedTreasuryProfitTaking,
  type MemeTreasuryPaperInput,
} from './meme-profit-policy.js'

export type MemeResearchSnapshot = {
  day: string  // YYYY-MM-DD
  observedAt: string
  availableAt: string
  sourceRef: string
  sourceKind: 'SYNTHETIC_FIXTURE' | 'READ_ONLY_RESEARCH'
  priceUsdPerSol: number
  hypotheticalPoolReserveSol: number
  hypotheticalPoolReserveTokens: number
}
export type MemeResearchStrategy = {
  id: string
  label: string
  hypotheticalSaleTokens: number
  assumedFixedOverheadUsd: number
  assumedNetworkCostSol: number
}
export type MemeResearchScorecard = {
  mode: 'PAPER_ONLY'
  sourceClass: 'SYNTHETIC_FIXTURE' | 'UNVERIFIED_READ_ONLY_RESEARCH'
  status: 'SYNTHETIC_REPLAY' | 'UNVERIFIED_RESEARCH_SCORING'
  strategyId: string
  scoreAt: string
  firstDay: string
  lastDay: string
  observations: readonly {
    day: string
    sourceRef: string
    admittedAt: string
    status: 'PAPER_SIMULATED' | 'REFUSED'
    hypotheticalNetPnlUsd: number | null
    refusalReasons: readonly string[]
  }[]
  admittedCount: number
  refusedCount: number
  meanHypotheticalPnlUsd: number | null
  worstHypotheticalPnlUsd: number | null
  maxHypotheticalDrawdownUsd: number
  netPositiveObservationCount: number
  actualTrades: 0
  actualEarningsUsd: 0
  ownerApprovalForExecution: false
  autopilotAuthorized: false
}
export type MemeResearchComparison = {
  mode: 'PAPER_ONLY'
  ranking: readonly {
    strategyId: string
    eligibleForRanking: boolean
    meanHypotheticalPnlUsd: number | null
    refusalCount: number
    maxHypotheticalDrawdownUsd: number
  }[]
  winnerForLiveTrading: null
  actualEarningsUsd: 0
}
const round=(v:number)=>Math.round((v+Number.EPSILON)*1e6)/1e6
const dayMillis=24*60*60*1000

export function scoreMemeResearchSnapshots(input: {
  snapshots: readonly MemeResearchSnapshot[]
  strategy: MemeResearchStrategy
  policyTemplate: MemeTreasuryPaperInput
  scoreAt: string
}): MemeResearchScorecard {
  const { snapshots, strategy, policyTemplate }=input
  if (snapshots.length!==7) throw Error('PAPER_RESEARCH_REQUIRES_EXACTLY_SEVEN_DAYS')
  const scoredAt=Date.parse(input.scoreAt)
  if (!Number.isFinite(scoredAt)) throw Error('PAPER_RESEARCH_INVALID_CLOCK')
  if (!/^[a-z0-9:_-]{2,80}$/i.test(strategy.id) ||
      !Number.isFinite(strategy.hypotheticalSaleTokens) || strategy.hypotheticalSaleTokens<=0 ||
      !Number.isFinite(strategy.assumedFixedOverheadUsd) || strategy.assumedFixedOverheadUsd<0 ||
      !Number.isFinite(strategy.assumedNetworkCostSol) || strategy.assumedNetworkCostSol<0) {
    throw Error('PAPER_RESEARCH_INVALID_STRATEGY')
  }
  const dataKinds=new Set(snapshots.map(s=>s.sourceKind))
  if (dataKinds.size!==1 || [...dataKinds].some(k=>k!=='SYNTHETIC_FIXTURE'&&k!=='READ_ONLY_RESEARCH')) {
    throw Error('PAPER_RESEARCH_SOURCE_MIX_OR_UNKNOWN')
  }
  const days=snapshots.map(s=>{
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.day)) throw Error('PAPER_RESEARCH_INVALID_DAY')
    const ts=Date.parse(s.day+'T00:00:00Z')
    if (!Number.isFinite(ts) || new Date(ts).toISOString().slice(0,10)!==s.day) {
      throw Error('PAPER_RESEARCH_INVALID_DAY')
    }
    return ts
  })
  for (let i=0;i<days.length;i++) {
    if (i && days[i]-days[i-1]!==dayMillis) throw Error('PAPER_RESEARCH_DATE_GAP_OR_DUPLICATE')
    const s=snapshots[i]
    const observed=Date.parse(s.observedAt),available=Date.parse(s.availableAt)
    if (!Number.isFinite(observed)||!Number.isFinite(available)||
        observed>available || available>scoredAt ||
        new Date(observed).toISOString().slice(0,10)!==s.day ||
        !s.sourceRef?.trim() || s.sourceRef.length>300) {
      throw Error('PAPER_RESEARCH_PROVENANCE_OR_LOOKAHEAD')
    }
    for (const value of [s.priceUsdPerSol,s.hypotheticalPoolReserveSol,s.hypotheticalPoolReserveTokens]) {
      if (!Number.isFinite(value) || value<=0) throw Error('PAPER_RESEARCH_INVALID_MARKET_ASSUMPTION')
    }
  }
  const observations:MemeResearchScorecard['observations'][number][]=[]
  let runningHypothetical=0,peak=0,maxDrawdown=0
  const admitted:number[]=[]
  for (const s of snapshots) {
    const report=simulateDisclosedTreasuryProfitTaking({
      ...policyTemplate,
      hypotheticalSolPriceUsd:s.priceUsdPerSol,
      poolReserveSol:s.hypotheticalPoolReserveSol,
      poolReserveTokens:s.hypotheticalPoolReserveTokens,
      assumedNetworkCostSolPerSale:strategy.assumedNetworkCostSol,
      estimatedBusinessOverheadUsd:strategy.assumedFixedOverheadUsd,
      plannedSales:[{day:1,tokens:strategy.hypotheticalSaleTokens}],
    })
    const ok=report.status==='SIMULATED'
    const pnl=ok ? report.hypotheticalProfitBeforeTaxUsd : null
    if (pnl!==null) {
      admitted.push(pnl)
      runningHypothetical+=pnl
      peak=Math.max(peak,runningHypothetical)
      maxDrawdown=Math.max(maxDrawdown,peak-runningHypothetical)
    }
    observations.push({
      day:s.day,sourceRef:s.sourceRef,admittedAt:s.availableAt,
      status:ok?'PAPER_SIMULATED':'REFUSED',hypotheticalNetPnlUsd:pnl,
      refusalReasons:report.refusals,
    })
  }
  return {
    mode:'PAPER_ONLY',
    sourceClass:dataKinds.has('SYNTHETIC_FIXTURE')?'SYNTHETIC_FIXTURE':'UNVERIFIED_READ_ONLY_RESEARCH',
    status:dataKinds.has('SYNTHETIC_FIXTURE')?'SYNTHETIC_REPLAY':'UNVERIFIED_RESEARCH_SCORING',
    strategyId:strategy.id,scoreAt:input.scoreAt,firstDay:snapshots[0].day,
    lastDay:snapshots[snapshots.length-1].day,observations,
    admittedCount:admitted.length,refusedCount:7-admitted.length,
    meanHypotheticalPnlUsd:admitted.length?round(admitted.reduce((a,b)=>a+b,0)/admitted.length):null,
    worstHypotheticalPnlUsd:admitted.length?round(Math.min(...admitted)):null,
    maxHypotheticalDrawdownUsd:round(maxDrawdown),
    netPositiveObservationCount:admitted.filter(x=>x>0).length,
    actualTrades:0,actualEarningsUsd:0,ownerApprovalForExecution:false,autopilotAuthorized:false,
  }
}

export function compareMemeResearchStrategies(cards:readonly MemeResearchScorecard[]):MemeResearchComparison {
  if (!cards.length || new Set(cards.map(c=>c.strategyId)).size!==cards.length) {
    throw Error('PAPER_RESEARCH_COMPARISON_INVALID')
  }
  if (cards.some(c=>c.mode!=='PAPER_ONLY' || c.actualTrades!==0 || c.actualEarningsUsd!==0 ||
      c.ownerApprovalForExecution!==false || c.autopilotAuthorized!==false ||
      c.firstDay!==cards[0].firstDay || c.lastDay!==cards[0].lastDay ||
      c.sourceClass!==cards[0].sourceClass)) throw Error('PAPER_RESEARCH_COMPARISON_PROVENANCE')
  const ranking=cards.map(card=>({
    strategyId:card.strategyId,
    eligibleForRanking:card.refusedCount===0 && card.admittedCount===7,
    meanHypotheticalPnlUsd:card.meanHypotheticalPnlUsd,
    refusalCount:card.refusedCount,
    maxHypotheticalDrawdownUsd:card.maxHypotheticalDrawdownUsd,
  })).sort((a,b)=>Number(b.eligibleForRanking)-Number(a.eligibleForRanking) ||
      (b.meanHypotheticalPnlUsd??-Infinity)-(a.meanHypotheticalPnlUsd??-Infinity) ||
      a.maxHypotheticalDrawdownUsd-b.maxHypotheticalDrawdownUsd ||
      a.strategyId.localeCompare(b.strategyId))
  return {mode:'PAPER_ONLY',ranking,winnerForLiveTrading:null,actualEarningsUsd:0}
}
