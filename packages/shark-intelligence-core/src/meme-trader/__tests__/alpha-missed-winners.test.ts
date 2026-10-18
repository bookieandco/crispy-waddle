import {describe,expect,it} from 'vitest'
import {auditAlphaMissedWinners} from '../alpha-missed-winners'
const a='2'.repeat(32),b='3'.repeat(32),c='4'.repeat(32)
const launch=(mint:string,eligibility:'PROSPECTIVE_PUMP_CREATE_RESEARCH'|'RETROSPECTIVE_OR_UNVERIFIED'='PROSPECTIVE_PUMP_CREATE_RESEARCH')=>({
 mint,launchEventId:'pump:'+mint,sourceAvailableAt:'2026-10-17T00:00:00Z',
 cohortAdmittedAt:'2026-10-17T00:00:05Z',eligibility,evidenceIds:['pump-receipt'],
})
const outcome=(mint:string,mark:'PRICE_ONLY_UP_2X'|'PRICE_ONLY_NOT_UP_2X'|'CENSORED_MISSING_OR_PAIR_SWITCH')=>({
 mint,observedAt:'2026-10-18T01:00:05Z',availableAt:'2026-10-18T01:00:06Z',
 hoursAfterLaunch:25,mark,evidenceIds:['provider-price-mark'],
})
const selection=(mint:string)=>({mint,strategy:'SHARK_FUSED' as const,decidedAt:'2026-10-17T00:00:06Z',
 decision:'HIGHLIGHT' as const,evidenceIds:['frozen-decision']})
const end='2026-10-18T02:00:00Z'
describe('all observed launches / missed-winner accounting .14',()=>{
 it('counts missed 2x price-only marks and censored outcomes without assuming whole-chain coverage',()=>{
  const r=auditAlphaMissedWinners({
   launches:[launch(a),launch(b),launch(c)],selections:[selection(a)],
   outcomes:[outcome(a,'PRICE_ONLY_UP_2X'),outcome(b,'PRICE_ONLY_UP_2X')],
   asOf:end,
  })
  expect(r.observedLaunches).toBe(3)
  expect(r.markedOutcomeCoverage).toBe(2)
  expect(r.missingOrCensored).toBe(1)
  expect(r.markedUp2xCount).toBe(2)
  expect(r.highlightedMarkedUp2xCount).toBe(1)
  expect(r.missedMarkedUp2xCount).toBe(1)
  expect(r.missedWinnerRate).toBe(.5)
  expect(r.estimatedAllPumpLaunches).toBeUndefined()
  expect(r.allLaunchCoverage).toBe('UNKNOWN_INCOMPLETE')
  expect(r.canTrade).toBe(false)
 })
 it('excludes retrospective launches, censored price marks and all unknown launches',()=>{
  const r=auditAlphaMissedWinners({launches:[launch(a),launch(b,'RETROSPECTIVE_OR_UNVERIFIED')],
   selections:[],outcomes:[outcome(a,'CENSORED_MISSING_OR_PAIR_SWITCH')],
   asOf:end})
  expect(r.eligibleProspectiveLaunches).toBe(1)
  expect(r.retrospectiveExcluded).toBe(1)
  expect(r.missedWinnerRate).toBeUndefined()
  expect(r.missingOrCensored).toBe(1)
 })
 it('rejects duplicate launches, future outcomes, and forged 24h clocks',()=>{
  const input={launches:[launch(a)],selections:[],outcomes:[],asOf:end}
  expect(()=>auditAlphaMissedWinners({...input,launches:[launch(a),launch(a)]})).toThrow('launch_invalid')
  expect(()=>auditAlphaMissedWinners({...input,outcomes:[{
   ...outcome(a,'PRICE_ONLY_UP_2X'),hoursAfterLaunch:24,
  }]})).toThrow('outcome_invalid')
  expect(()=>auditAlphaMissedWinners({...input,outcomes:[{
   ...outcome(a,'PRICE_ONLY_UP_2X'),availableAt:'2026-10-19T00:00:00Z',
  }]})).toThrow('outcome_invalid')
 })
})
