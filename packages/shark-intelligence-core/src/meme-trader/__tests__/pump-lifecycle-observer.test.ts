import {describe,expect,it} from 'vitest'
import {PUMPSWAP_AMM_PROGRAM_ID} from '../dex-liquidity-decoder'
import {observePumpLifecycle} from '../pump-lifecycle-observer'
import {PUMP_MIGRATE_V2_DISCRIMINATOR,PUMP_PROGRAM_ID} from '../pump-migration-verifier'

const observation={
  observationId:'curve:1',mint:'BASE',quoteMint:'USDC',bondingCurveAddress:'CURVE',
  observedAt:'2026-10-03T03:00:00Z',availableAt:'2026-10-03T03:00:01Z',
  initialRealTokenReserves:1000n,realTokenReserves:0n,complete:true,
  holderCount:500,uniqueBuyerCount:300,volumeAccelerationScore:.8,buyPressureScore:.8,holderGrowthScore:.8,
  creatorRiskScore:.1,clusterRiskScore:.1,sniperInventoryRisk:.1,rugBlocked:false,
  evidenceIds:['curve:evidence'],
} as const

describe('Pump lifecycle observer',()=>{
  it('keeps a completed curve separate from verified PumpSwap readiness',()=>{
    const result=observePumpLifecycle({observation})
    expect(result.radar.stage).toBe('CURVE_COMPLETE')
    expect(result.verifiedMigration).toBeUndefined()
    expect(result.canAuthorizeTrade).toBe(false)
  })

  it('promotes to migrated only through strict migration verification',()=>{
    const result=observePumpLifecycle({
      observation,
      migration:{
        migrationId:'migration:1',observedAt:'2026-10-03T03:00:02Z',
        pumpProgramId:PUMP_PROGRAM_ID,instructionDiscriminator:PUMP_MIGRATE_V2_DISCRIMINATOR,
        baseMint:'BASE',quoteMint:'USDC',bondingCurveAddress:'CURVE',bondingCurveComplete:true,
        pumpSwapProgramId:PUMPSWAP_AMM_PROGRAM_ID,pumpSwapPoolAddress:'POOL',pumpSwapPoolIndex:0,
        pumpSwapBaseMint:'BASE',pumpSwapQuoteMint:'USDC',canonicalPoolCreatorVerified:true,
        evidenceIds:['tx:migrate','pool:canonical'],
      },
    })
    expect(result.radar.stage).toBe('PUMPSWAP_MIGRATED')
    expect(result.radar.pumpSwapPoolAddress).toBe('POOL')
    expect(result.genericMigrationEvidence?.kind).toBe('POOL_MIGRATION')
    expect(result.authority).toBe('EVIDENCE_AND_RESEARCH_ONLY')
  })

  it('rejects migration evidence for a different mint',()=>{
    expect(()=>observePumpLifecycle({
      observation,
      migration:{
        migrationId:'migration:bad',observedAt:'2026-10-03T03:00:02Z',
        pumpProgramId:PUMP_PROGRAM_ID,instructionDiscriminator:PUMP_MIGRATE_V2_DISCRIMINATOR,
        baseMint:'OTHER',quoteMint:'USDC',bondingCurveAddress:'CURVE',bondingCurveComplete:true,
        pumpSwapProgramId:PUMPSWAP_AMM_PROGRAM_ID,pumpSwapPoolAddress:'POOL',pumpSwapPoolIndex:0,
        pumpSwapBaseMint:'OTHER',pumpSwapQuoteMint:'USDC',canonicalPoolCreatorVerified:true,
        evidenceIds:['tx:migrate'],
      },
    })).toThrow('migration_mint_mismatch')
  })
})
