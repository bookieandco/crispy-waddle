import {describe,expect,it} from 'vitest'
import {
  createStalkChainThesisEvidence,
  createStalkChainTraderIdentity,
  rankEmergingStalkChainTraders,
  summarizeStalkChainTraderTrackRecord,
  traderIdentityKey,
  type StalkChainTraderPositionOutcome,
} from '../stalkchain-trader-intelligence'

const outcome=(id:string,token:string,pnl:number,returnBps:number):StalkChainTraderPositionOutcome=>({
  outcomeId:id,traderKey:'fomo-user:u1',tokenAddress:token,
  openedAt:'2026-10-01T00:00:00Z',closedAt:'2026-10-01T01:00:00Z',
  realizedPnlUsd:pnl,executableReturnBps:returnBps,rug:false,evidenceIds:['e:'+id],
})

describe('StalkChain trader intelligence',()=>{
  it('prefers stable user id over mutable handles',()=>{
    const identity=createStalkChainTraderIdentity({
      stableUserId:'u1',handle:'@OldHandle',followers:123,observedAt:'2026-10-05T00:00:00Z',evidenceId:'leaderboard:1',
    })
    expect(traderIdentityKey(identity)).toBe('fomo-user:u1')
    expect(identity.handle).toBe('OldHandle')
    expect(identity.canAuthorizeTrade).toBe(false)
  })

  it('measures repeatability and exposes lottery dependence',()=>{
    const record=summarizeStalkChainTraderTrackRecord('fomo-user:u1',[
      outcome('1','A',100,1000),
      outcome('2','B',80,800),
      outcome('3','C',60,600),
      outcome('4','D',-50,-500),
      outcome('5','E',-40,-400),
    ])
    expect(record.distinctTokenCount).toBe(5)
    expect(record.winRate).toBe(.6)
    expect(record.totalRealizedPnlUsd).toBe(150)
    expect(record.lotteryDependence).toBeCloseTo(100/240)
    expect(record.repeatabilityScore).toBeGreaterThan(0)
    expect(record.canAutoCopy).toBe(false)
  })

  it('penalizes one-tail-winner records in emerging-trader ranking',()=>{
    const balanced=summarizeStalkChainTraderTrackRecord('fomo-user:u1',[
      outcome('1','A',100,1000),outcome('2','B',90,900),outcome('3','C',80,800),
      outcome('4','D',70,700),outcome('5','E',-20,-200),outcome('6','F',-20,-200),
    ])
    const lotteryRows:StalkChainTraderPositionOutcome[]=[
      { ...outcome('7','G',1000,10000),traderKey:'fomo-user:u2' },
      { ...outcome('8','H',-100,-1000),traderKey:'fomo-user:u2' },
      { ...outcome('9','I',-100,-1000),traderKey:'fomo-user:u2' },
      { ...outcome('10','J',-100,-1000),traderKey:'fomo-user:u2' },
      { ...outcome('11','K',-100,-1000),traderKey:'fomo-user:u2' },
      { ...outcome('12','L',-100,-1000),traderKey:'fomo-user:u2' },
    ]
    const lottery=summarizeStalkChainTraderTrackRecord('fomo-user:u2',lotteryRows)
    const ranked=rankEmergingStalkChainTraders([
      {traderKey:'fomo-user:u1',followers:500,trackRecord:balanced},
      {traderKey:'fomo-user:u2',followers:500,trackRecord:lottery},
    ],{minClosedSamples:5})
    expect(ranked[0]?.traderKey).toBe('fomo-user:u1')
    expect(ranked[1]?.reasons).toContain('tail-winner-dependent')
    expect(ranked.every(row=>row.canAuthorizeTrade===false)).toBe(true)
  })

  it('keeps written theses as evidence instead of factual authority',()=>{
    const thesis=createStalkChainThesisEvidence({
      thesisId:'t1',traderKey:'fomo-user:u1',tokenAddress:'TOKEN',text:' catalyst thesis ',
      writtenAt:'2026-10-05T00:00:00Z',positionValueUsd:5000,likes:20,evidenceIds:['fomo:thesis:t1'],
    })
    expect(thesis.text).toBe('catalyst thesis')
    expect(thesis.authority).toBe('EVIDENCE_ONLY')
    expect(thesis.canAuthorizeTrade).toBe(false)
  })
})
