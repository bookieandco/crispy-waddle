import type { MemePaperRecovery } from './meme-wallet-paper-scheduler.js'

/** MEME-WALLET.16: paper-experiment completeness, not profitability.
 * Simulated token atomic outputs are NOT valuations; converting them into
 * returns or drawdowns without independent exit/quote receipts would lie.
 */
export function scoreMemeWalletPaperSevenDay(input:Readonly<{
  expectedUtcDays:readonly string[]
  recovered:readonly MemePaperRecovery[]
  independentExitValuationsVerified:boolean
  authorizedSourceCoverageVerified:boolean
}>){
  const days=input.expectedUtcDays
  if(days.length!==7||new Set(days).size!==7||
     days.some((d,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||
       !Number.isFinite(Date.parse(d+'T00:00:00.000Z')) ||
       (i>0 && Date.parse(d)!==Date.parse(days[i-1]!)+86400000)))
    throw Error('MEME_PAPER_SCORECARD_DAYS_INVALID')
  const recovered=new Map<string,MemePaperRecovery>()
  for(const r of input.recovered){
    const day=r.state.day
    if(!days.includes(day)||recovered.has(day)||
       r.authority!=='PAPER_JOURNAL_OBSERVATION_ONLY'||
       r.canExecute!==false||r.performanceCertified!==false||
       r.realizedProfitMinor!==null||r.drawdownBps!==null)
      throw Error('MEME_PAPER_SCORECARD_EVIDENCE_INVALID')
    recovered.set(day,r)
  }
  const observed=[...recovered.values()]
  const total=(pick:(r:MemePaperRecovery)=>number)=>
    observed.reduce((n,v)=>n+pick(v),0)
  const costs=observed.reduce((n,v)=>n+v.costMinor,0n)
  const blocked=total(v=>v.blocked)
  const filled=total(v=>v.simulatedFilled)
  const unknown=total(v=>v.simulatedUnknown)
  const pending=total(v=>v.pending)
  const failed=total(v=>v.simulatedFailed)
  const hasUnresolved=observed.some(v=>v.state.unresolvedIds.length>0)
  const missing=days.filter(d=>!recovered.has(d))
  const blockers:string[]=[]
  if(missing.length)blockers.push('INCOMPLETE_SEVEN_DAY_COVERAGE')
  if(unknown||pending||hasUnresolved)blockers.push('UNRESOLVED_PAPER_OUTCOMES')
  if(observed.some(v=>v.state.halted))blockers.push('PAPER_KILL_SWITCH_TRIGGERED')
  if(!input.authorizedSourceCoverageVerified)blockers.push('SOURCE_COVERAGE_NOT_VERIFIED')
  if(!input.independentExitValuationsVerified)blockers.push('EXIT_VALUATION_NOT_VERIFIED')
  // Gate deliberately refuses profitability certification in .16 even if
  // callers supply all flags, because journal has no independent exit ledger.
  blockers.push('REALIZED_PNL_AND_DRAWDOWN_NOT_SUPPORTED_BY_JOURNAL')
  return Object.freeze({
    observedDays:observed.length,missingDays:Object.freeze(missing),
    candidateCases:total(v=>v.candidates),
    blockedCandidates:blocked,
    simulatedFilled:filled,simulatedFailed:failed,
    simulatedUnknown:unknown,pending,
    recordedSimulatedCostMinor:costs,
    realizedPnlMinor:null,drawdownBps:null,winRate:null,
    verifiedProfitableTrades:null,
    status:'INCOMPLETE' as const,blockers:Object.freeze(blockers),
    authority:'PAPER_EVALUATION_NOT_FINANCIAL_PERFORMANCE' as const,
    canExecute:false as const,canAuthorizeLive:false as const,
  })
}
