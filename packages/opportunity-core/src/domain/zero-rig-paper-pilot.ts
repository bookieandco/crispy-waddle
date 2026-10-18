/** JH-ZERO-RIG.08 — seven calendar days of PAPER analysis. No scheduler or provider IO. */
export type ZeroRigPaperDay = {
  date: string
  simulatedGrossUsd: number
  simulatedCostUsd: number
  simulatedEffortHours: number
  simulatedOpportunitiesReviewed: number
  evidenceRefs: string[]
  mode: 'paper'
}
export type ZeroRigPaperPilotEvaluation = {
  experimentId: string
  plannedDays: 7
  observedDays: number
  status: 'paper_planned' | 'paper_incomplete' | 'paper_evaluated'
  startDate: string
  endDate: string
  daily: Array<{ date: string; status: 'pending' | 'paper_observed'; simulatedNetUsd: number | null }>
  simulatedNetUsd: number | null
  simulatedUsdPerHour: number | null
  conclusions: string[]
  spendingAuthorized: false
  externalActionsAuthorized: false
  actualRevenueUsd: null
  requiresOwnerReview: true
}
const DAY = 24 * 3600000
const isDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v + 'T00:00:00.000Z')) &&
  new Date(Date.parse(v + 'T00:00:00.000Z')).toISOString().slice(0,10) === v
const nonNeg = (n: number): boolean => typeof n === 'number' && Number.isFinite(n) && n >= 0
export function evaluateZeroRigPaperPilot(input: {
  experimentId: string
  startDate: string
  asOf: string
  observations: readonly ZeroRigPaperDay[]
}): ZeroRigPaperPilotEvaluation {
  if (!input.experimentId.trim() || !isDate(input.startDate)) throw new Error('ZERO_RIG_INVALID_EXPERIMENT')
  const now = Date.parse(input.asOf)
  if (!Number.isFinite(now)) throw new Error('ZERO_RIG_INVALID_AS_OF')
  const start = Date.parse(input.startDate + 'T00:00:00.000Z')
  const dates = Array.from({length:7},(_,i)=>new Date(start+i*DAY).toISOString().slice(0,10))
  const set = new Map<string, ZeroRigPaperDay>()
  for (const observation of input.observations) {
    if (!dates.includes(observation.date) || set.has(observation.date) ||
      observation.mode !== 'paper' || !isDate(observation.date) ||
      Date.parse(observation.date + 'T00:00:00.000Z') > now ||
      !nonNeg(observation.simulatedGrossUsd) || !nonNeg(observation.simulatedCostUsd) ||
      !nonNeg(observation.simulatedEffortHours) ||
      !Number.isSafeInteger(observation.simulatedOpportunitiesReviewed) ||
      observation.simulatedOpportunitiesReviewed < 0 ||
      !observation.evidenceRefs.length || observation.evidenceRefs.some(x=>!x.trim())) {
      throw new Error('ZERO_RIG_INVALID_PAPER_OBSERVATION')
    }
    set.set(observation.date, observation)
  }
  const days = dates.map(date => {
    const o = set.get(date)
    return { date, status: o ? 'paper_observed' as const : 'pending' as const,
      simulatedNetUsd: o ? o.simulatedGrossUsd - o.simulatedCostUsd : null }
  })
  const observedDays = set.size
  const totalNet = [...set.values()].reduce((n,v)=>n+v.simulatedGrossUsd-v.simulatedCostUsd,0)
  const hours = [...set.values()].reduce((n,v)=>n+v.simulatedEffortHours,0)
  const finished = observedDays===7 && now>=start+6*DAY
  return {
    experimentId:input.experimentId, plannedDays:7, observedDays,
    status:observedDays===0?'paper_planned':finished?'paper_evaluated':'paper_incomplete',
    startDate:input.startDate, endDate:dates[6], daily:days,
    simulatedNetUsd:observedDays ? totalNet : null,
    simulatedUsdPerHour:observedDays && hours>0 ? totalNet/hours : null,
    conclusions:finished
      ? ['Seven paper observations evaluated; none represents live revenue or payout proof',
         'Live revenue requires canonical Money Core transaction and receipt reconciliation']
      : ['Pilot is not complete; missing day evidence must not be fabricated'],
    spendingAuthorized:false, externalActionsAuthorized:false, actualRevenueUsd:null,
    requiresOwnerReview:true,
  }
}
