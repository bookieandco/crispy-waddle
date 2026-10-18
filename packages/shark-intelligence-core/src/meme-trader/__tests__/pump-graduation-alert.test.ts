import {describe,expect,it,vi} from 'vitest'
import {buildPumpMigrationRadarCandidate} from '../migration-radar'
import {evaluatePumpGraduationAlert,formatOwnerPumpGraduationAlert,deliverOwnerPumpGraduationAlert} from '../pump-graduation-alert'

const observedAt='2026-10-17T18:00:00Z'
const availableAt='2026-10-17T18:00:01Z'
const assessedAt='2026-10-17T18:00:02Z'
const base={
  observationId:'a',mint:'MINT-A',observedAt,availableAt,evidenceIds:['slot-100'],
  initialRealTokenReserves:1000n,
  holderCount:500,uniqueBuyerCount:350,volumeAccelerationScore:1,
  buyPressureScore:1,holderGrowthScore:1,
  creatorRiskScore:.1,clusterRiskScore:.1,sniperInventoryRisk:.1,rugBlocked:false,
}
const candidate=(remaining:bigint,other:Record<string,unknown>={})=>
  buildPumpMigrationRadarCandidate({...base,realTokenReserves:remaining,...other})
describe('Pump graduation owner-only alerts',()=>{
  it('announces crossing 90% and imminent 98%, and deduplicates repeated stage',()=>{
    const early=candidate(200n)
    const near=candidate(90n,{observationId:'b'})
    const imminent=candidate(10n,{observationId:'c'})
    expect(evaluatePumpGraduationAlert({current:early,assessedAt})).toBeNull()
    const alert=evaluatePumpGraduationAlert({current:near,previous:early,assessedAt})!
    expect(alert.kind).toBe('NEAR_CURVE')
    expect(alert.progressPercent).toBe(91)
    expect(alert.canAutoSnipe).toBe(false)
    expect(alert.paperFeasibility).toBe('NOT_ASSESSED')
    expect(evaluatePumpGraduationAlert({current:near,previous:near,assessedAt})).toBeNull()
    const last=evaluatePumpGraduationAlert({current:imminent,previous:near,assessedAt})!
    expect(last.kind).toBe('IMMINENT_CURVE')
    expect(last.alertId).toContain('MINT-A')
  })
  it('separates pool unverified from migrated, never claiming executable sells',()=>{
    const nearing=candidate(10n)
    const unverified=candidate(0n,{complete:true,pumpSwapPoolAddress:'POOL',observationId:'d'})
    const first=evaluatePumpGraduationAlert({current:unverified,previous:nearing,assessedAt})!
    expect(first.kind).toBe('CURVE_COMPLETE_POOL_UNVERIFIED')
    expect(first.missingChecks).toContain('pumpswap-pool-verification')
    const migrated=candidate(0n,{complete:true,pumpSwapPoolAddress:'POOL',pumpSwapPoolVerified:true,observationId:'e'})
    const next=evaluatePumpGraduationAlert({current:migrated,previous:unverified,assessedAt})!
    expect(next.kind).toBe('POOL_MIGRATION_OBSERVED')
    expect(next.executableSellVerified).toBe(false)
    expect(next.canAuthorizeTrade).toBe(false)
  })
  it('blocks on rug risk and warns independently of a high discovery score',()=>{
    const near=candidate(70n)
    const risky=candidate(60n,{rugBlocked:true,observationId:'risk'})
    const warning=evaluatePumpGraduationAlert({current:risky,previous:near,assessedAt})!
    expect(warning.kind).toBe('RISK_BLOCKED')
    expect(warning.paperFeasibility).toBe('BLOCKED')
    expect(warning.blockers).toContain('rug-protection-block')
    const recovered=candidate(10n,{observationId:'recovered'})
    expect(evaluatePumpGraduationAlert({current:recovered,previous:risky,assessedAt})?.kind).toBe('IMMINENT_CURVE')
  })
  it('fails closed on stale, future, or cross-mint evidence and stale quote receipts',()=>{
    const current=candidate(30n)
    expect(evaluatePumpGraduationAlert({current,assessedAt:'2026-10-17T18:01:01Z'})).toBeNull()
    expect(()=>evaluatePumpGraduationAlert({current,assessedAt:observedAt})).toThrow('future_evidence')
    expect(()=>evaluatePumpGraduationAlert({current,previous:candidate(100n,{mint:'OTHER'}),assessedAt})).toThrow('cross_mint')
    const withQuote=evaluatePumpGraduationAlert({
      current,assessedAt,quoteResearch:{
        receiptId:'watchkeeper-1',observedAt:'2026-10-17T17:58:00Z',
        source:'WATCHKEEPER_INDICATIVE_PAIR',hasForwardAndReverseQuotes:true,
      },
    })!
    expect(withQuote.paperFeasibility).toBe('NOT_ASSESSED')
    const paired=evaluatePumpGraduationAlert({
      current,assessedAt,quoteResearch:{
        receiptId:'watchkeeper-2',observedAt:'2026-10-17T18:00:01Z',
        source:'WATCHKEEPER_INDICATIVE_PAIR',hasForwardAndReverseQuotes:true,
      },
    })!
    expect(paired.paperFeasibility).toBe('PAPER_REVIEW_ONLY')
    expect(paired.executableSellVerified).toBe(false)
  })
  it('requires owner authentication for outbound delivery, never calls a trading executor',async()=>{
    const alert=evaluatePumpGraduationAlert({current:candidate(70n),assessedAt})!
    const sendOwner=vi.fn(async()=>{})
    await expect(deliverOwnerPumpGraduationAlert({alert,ownerAuthenticated:false,sendOwner})).rejects.toThrow('owner_required')
    expect(sendOwner).not.toHaveBeenCalled()
    await deliverOwnerPumpGraduationAlert({alert,ownerAuthenticated:true,sendOwner})
    expect(sendOwner).toHaveBeenCalledTimes(1)
    expect(sendOwner.mock.calls[0]?.[1]).toBeUndefined()
    expect(formatOwnerPumpGraduationAlert(alert)).toContain('NO TRADE AUTHORITY')
    expect(formatOwnerPumpGraduationAlert(alert)).toContain('No automatic snipe')
  })
})
