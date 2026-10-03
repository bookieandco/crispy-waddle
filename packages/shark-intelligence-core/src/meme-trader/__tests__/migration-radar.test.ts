import {describe,expect,it} from 'vitest'
import {
  buildPumpMigrationRadarCandidate,
  classifyPumpMigrationStage,
  pumpGraduationProgress,
} from '../migration-radar'

describe('Pump migration radar',()=>{
  it('derives point-in-time graduation progress from real reserves',()=>{
    expect(pumpGraduationProgress({initialRealTokenReserves:1000n,realTokenReserves:100n})).toBe(0.9)
    expect(classifyPumpMigrationStage({
      observationId:'o',mint:'MINT',observedAt:'2026-10-03T03:00:00Z',availableAt:'2026-10-03T03:00:01Z',
      initialRealTokenReserves:1000n,realTokenReserves:100n,evidenceIds:['e'],
    })).toBe('APPROACHING_GRADUATION')
  })

  it('prefers observed PumpSwap migration over inferred curve state',()=>{
    const candidate=buildPumpMigrationRadarCandidate({
      observationId:'o2',mint:'MINT2',observedAt:'2026-10-03T03:00:00Z',availableAt:'2026-10-03T03:00:01Z',
      initialRealTokenReserves:1000n,realTokenReserves:0n,complete:true,pumpSwapPoolAddress:'POOL',
      holderCount:500,uniqueBuyerCount:300,volumeAccelerationScore:.8,buyPressureScore:.75,holderGrowthScore:.7,
      creatorRiskScore:.1,clusterRiskScore:.2,sniperInventoryRisk:.2,rugBlocked:false,evidenceIds:['curve','pool'],
    })
    expect(candidate.stage).toBe('PUMPSWAP_MIGRATED')
    expect(candidate.disposition).toBe('WATCH')
    expect(candidate.authority).toBe('RESEARCH_ONLY')
    expect(candidate.canAuthorizeTrade).toBe(false)
  })

  it('fails closed into review when canonical checks are missing',()=>{
    const candidate=buildPumpMigrationRadarCandidate({
      observationId:'o3',mint:'MINT3',observedAt:'2026-10-03T03:00:00Z',availableAt:'2026-10-03T03:00:01Z',
      initialRealTokenReserves:1000n,realTokenReserves:50n,volumeAccelerationScore:1,buyPressureScore:1,holderGrowthScore:1,
      evidenceIds:['curve'],
    })
    expect(candidate.stage).toBe('APPROACHING_GRADUATION')
    expect(candidate.disposition).toBe('REVIEW')
    expect(candidate.missingChecks).toContain('rug-protection')
    expect(candidate.missingChecks).toContain('cluster-risk')
  })

  it('lets deterministic defensive blockers dominate momentum',()=>{
    const candidate=buildPumpMigrationRadarCandidate({
      observationId:'o4',mint:'MINT4',observedAt:'2026-10-03T03:00:00Z',availableAt:'2026-10-03T03:00:01Z',
      initialRealTokenReserves:1000n,realTokenReserves:10n,holderCount:1000,uniqueBuyerCount:800,
      volumeAccelerationScore:1,buyPressureScore:1,holderGrowthScore:1,
      creatorRiskScore:.1,clusterRiskScore:.1,sniperInventoryRisk:.1,rugBlocked:true,evidenceIds:['curve','rug'],
    })
    expect(candidate.disposition).toBe('BLOCK')
    expect(candidate.blockers).toContain('rug-protection-block')
  })
})
