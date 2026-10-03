import {describe,expect,it} from 'vitest'
import {
  assertSharkMakeItMakeSenseVote,
  createSharkMakeItMakeSenseVote,
  sharkMimsEligibility,
} from '../shark-make-it-make-sense'

const checks=(status:'PASS'|'REVIEW'|'FAIL'='PASS')=>[
  {dimension:'EVIDENCE' as const,status,rationale:'Evidence reviewed.',evidenceRefs:['e1']},
  {dimension:'CHRONOLOGY' as const,status:'PASS' as const,rationale:'Chronology reviewed.',evidenceRefs:['e1']},
  {dimension:'CAUSAL_LOGIC' as const,status:'PASS' as const,rationale:'Causal logic reviewed.',evidenceRefs:['e1']},
  {dimension:'INCENTIVES' as const,status:'PASS' as const,rationale:'Incentives reviewed.',evidenceRefs:['e1']},
  {dimension:'BASE_RATES' as const,status:'PASS' as const,rationale:'Base rates reviewed.',evidenceRefs:['e1']},
  {dimension:'CONTRADICTIONS' as const,status:'PASS' as const,rationale:'Contradictions reviewed.',evidenceRefs:['e1']},
  {dimension:'ALTERNATIVES' as const,status:'PASS' as const,rationale:'Alternatives reviewed.',evidenceRefs:['e1']},
]

describe('SHARK staged MAKE IT MAKE SENSE',()=>{
  it('binds trade-stage votes to the candidate without gaining authority',()=>{
    const staged=createSharkMakeItMakeSenseVote({
      stage:'TRADE',voteId:'mims:t1',subjectId:'opp:1',checks:checks(),
    })
    expect(()=>assertSharkMakeItMakeSenseVote(staged,{stage:'TRADE',subjectId:'opp:1'})).not.toThrow()
    expect(staged.canAuthorizeAction).toBe(false)
    expect(staged.vote.authority).toBe('ADVISORY_ONLY')
  })

  it('allows REVIEW only for paper/shadow and requires PASS for live-governed admission',()=>{
    const review=createSharkMakeItMakeSenseVote({
      stage:'TRADE',voteId:'mims:t2',subjectId:'opp:2',checks:checks('REVIEW'),
    })
    expect(sharkMimsEligibility({vote:review.vote,mode:'PAPER'}).eligible).toBe(true)
    expect(sharkMimsEligibility({vote:review.vote,mode:'SHADOW'}).eligible).toBe(true)
    expect(sharkMimsEligibility({vote:review.vote,mode:'LIVE_GOVERNED'})).toMatchObject({
      eligible:false,reasonCodes:['MIMS_PASS_REQUIRED_FOR_LIVE'],canAuthorizeTrade:false,
    })
  })

  it('blocks FAIL at every autonomy level',()=>{
    const fail=createSharkMakeItMakeSenseVote({
      stage:'TRADE',voteId:'mims:t3',subjectId:'opp:3',checks:checks('FAIL'),
    })
    for(const mode of ['PAPER','SHADOW','LIVE_GOVERNED'] as const){
      expect(sharkMimsEligibility({vote:fail.vote,mode}).eligible).toBe(false)
    }
  })
})
