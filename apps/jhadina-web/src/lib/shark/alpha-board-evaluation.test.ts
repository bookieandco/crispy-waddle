import {describe,expect,it} from 'vitest'
import {auditAlphaMissedWinners,compareFrozenAlphaBaselines} from '@jhadina/shark-intelligence-core/meme-trader'
import {buildAlphaBoardSnapshot,parseAlphaBoardSnapshot} from './alpha-board-view'
const mint='2'.repeat(32)
const cohort=auditAlphaMissedWinners({
 launches:[{mint,launchEventId:'create:1',sourceAvailableAt:'2026-10-17T00:00:00Z',
  cohortAdmittedAt:'2026-10-17T00:00:01Z',eligibility:'PROSPECTIVE_PUMP_CREATE_RESEARCH',
  evidenceIds:['pump-create:1']}],
 selections:[],
 outcomes:[{mint,observedAt:'2026-10-18T01:00:01Z',availableAt:'2026-10-18T01:00:02Z',
  hoursAfterLaunch:25,mark:'PRICE_ONLY_UP_2X',evidenceIds:['price-only:1']}],
 asOf:'2026-10-18T02:00:00Z',
})
const strategies=['SHARK_FUSED','CHAIN_ONLY','MOMENTUM_ONLY'] as const
const baselines=compareFrozenAlphaBaselines({
 cohortMints:[mint],decisions:strategies.map(strategy=>({
  mint,strategy,decision:'ABSTAIN' as const,frozenAt:'2026-10-17T00:00:02Z',
  evidenceAvailableAt:'2026-10-17T00:00:01Z',receiptId:'decision:'+strategy,
 })),
 outcomes:[{mint,horizon:'24H_PRICE_ONLY',markedAt:'2026-10-18T01:00:01Z',
  availableAt:'2026-10-18T01:00:02Z',priceDirection:'UP',samePoolVerified:true,
  receiptId:'quote:1'}],asOf:'2026-10-18T02:00:00Z',
})
describe('Alpha Board outcome and missed-winner aggregate serialization .14-.16',()=>{
 it('renders aggregate-only denominator, censoring, paired baseline and no-fills flags',()=>{
  const board=buildAlphaBoardSnapshot({
   generatedAt:'2026-10-18T02:00:03Z',sourceHealth:[],comparisons:[],cohort,baselines,
  })
  const parsed=parseAlphaBoardSnapshot(JSON.parse(JSON.stringify(board)))
  expect(parsed.evaluation?.observedLaunches).toBe(1)
  expect(parsed.evaluation?.missedPriceOnly2x).toBe(1)
  expect(parsed.evaluation?.baselineCohort).toBe(1)
  expect(parsed.evaluation?.pairedPriceOnlyMarks).toBe(1)
  expect(parsed.evaluation?.executableProfitsVerified).toBe(false)
  expect(parsed.evaluation?.canTrade).toBe(false)
  expect(JSON.stringify(parsed)).not.toContain('sourceHandle')
 })
 it('rejects fabricated profitability or impossible outcomes in a local snapshot',()=>{
  const board=buildAlphaBoardSnapshot({
   generatedAt:'2026-10-18T02:00:03Z',sourceHealth:[],comparisons:[],cohort,baselines,
  })
  expect(()=>parseAlphaBoardSnapshot({...board,evaluation:{
   ...board.evaluation,executableProfitsVerified:true,
  }})).toThrow('evaluation_invalid')
  expect(()=>parseAlphaBoardSnapshot({...board,evaluation:{
   ...board.evaluation,missedPriceOnly2x:10,
  }})).toThrow('evaluation_invalid')
 })
})
