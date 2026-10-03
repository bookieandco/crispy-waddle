import {describe,expect,it} from 'vitest'
import {PUMPSWAP_AMM_PROGRAM_ID} from '../dex-liquidity-decoder'
import {
  PUMP_MIGRATE_DISCRIMINATOR,
  PUMP_MIGRATE_V2_DISCRIMINATOR,
  PUMP_PROGRAM_ID,
  pumpMigrationToGenericEvidence,
  verifyPumpMigration,
} from '../pump-migration-verifier'

const base={
  migrationId:'migration-1',
  observedAt:'2026-10-03T03:00:00Z',
  pumpProgramId:PUMP_PROGRAM_ID,
  instructionDiscriminator:PUMP_MIGRATE_DISCRIMINATOR,
  baseMint:'BASE',
  quoteMint:'QUOTE',
  bondingCurveAddress:'CURVE',
  bondingCurveComplete:true,
  pumpSwapProgramId:PUMPSWAP_AMM_PROGRAM_ID,
  pumpSwapPoolAddress:'POOL',
  pumpSwapPoolIndex:0,
  pumpSwapBaseMint:'BASE',
  pumpSwapQuoteMint:'QUOTE',
  canonicalPoolCreatorVerified:true,
  evidenceIds:['tx:migrate','account:curve','account:pool'],
} as const

describe('Pump migration verifier',()=>{
  it('accepts canonical migrate and emits generic migration evidence',()=>{
    const verified=verifyPumpMigration(base)
    expect(verified.instructionKind).toBe('MIGRATE')
    expect(verified.confidence).toBe(1)
    expect(verified.canAuthorizeTrade).toBe(false)
    const generic=pumpMigrationToGenericEvidence(verified)
    expect(generic.kind).toBe('POOL_MIGRATION')
    expect(generic.destinationPool).toBe('POOL')
  })

  it('accepts migrate_v2 for non-SOL quote assets',()=>{
    const verified=verifyPumpMigration({...base,instructionDiscriminator:PUMP_MIGRATE_V2_DISCRIMINATOR,quoteMint:'USDC',pumpSwapQuoteMint:'USDC'})
    expect(verified.instructionKind).toBe('MIGRATE_V2')
    expect(verified.quoteMint).toBe('USDC')
  })

  it('rejects complete curves without canonical PumpSwap proof',()=>{
    expect(()=>verifyPumpMigration({...base,pumpSwapPoolIndex:1})).toThrow('noncanonical_pool_index')
    expect(()=>verifyPumpMigration({...base,canonicalPoolCreatorVerified:false})).toThrow('pool_creator_unverified')
    expect(()=>verifyPumpMigration({...base,pumpSwapProgramId:'OTHER'})).toThrow('destination_program_invalid')
  })

  it('rejects unknown migration instructions and mint mismatch',()=>{
    expect(()=>verifyPumpMigration({...base,instructionDiscriminator:[1,2,3,4,5,6,7,8]})).toThrow('instruction_invalid')
    expect(()=>verifyPumpMigration({...base,pumpSwapBaseMint:'OTHER'})).toThrow('base_mint_mismatch')
  })
})
