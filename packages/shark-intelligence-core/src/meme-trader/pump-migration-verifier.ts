import {PUMPSWAP_AMM_PROGRAM_ID} from './dex-liquidity-decoder'
import type {TokenMigrationEvidence} from './migration-classification'

export const PUMP_PROGRAM_ID='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
export const PUMP_MIGRATE_DISCRIMINATOR=Object.freeze([155,234,231,146,236,158,162,30] as const)
export const PUMP_MIGRATE_V2_DISCRIMINATOR=Object.freeze([187,203,18,31,206,237,254,41] as const)
export const PUMP_CANONICAL_POOL_INDEX=0

export type PumpMigrationInstructionKind='MIGRATE'|'MIGRATE_V2'

export type PumpMigrationVerificationInput=Readonly<{
  migrationId:string
  observedAt:string
  pumpProgramId:string
  instructionDiscriminator:readonly number[]
  baseMint:string
  quoteMint?:string
  bondingCurveAddress:string
  bondingCurveComplete:boolean
  pumpSwapProgramId:string
  pumpSwapPoolAddress:string
  pumpSwapPoolIndex:number
  pumpSwapBaseMint:string
  pumpSwapQuoteMint?:string
  canonicalPoolCreatorVerified:boolean
  evidenceIds:readonly string[]
}>

export type VerifiedPumpMigration=Readonly<{
  migrationId:string
  instructionKind:PumpMigrationInstructionKind
  observedAt:string
  baseMint:string
  quoteMint?:string
  bondingCurveAddress:string
  pumpSwapPoolAddress:string
  confidence:1
  evidenceIds:readonly string[]
  authority:'EVIDENCE_ONLY'
  canAuthorizeTrade:false
}>

const sameDiscriminator=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((value,index)=>value===b[index])
const instructionKind=(value:readonly number[]):PumpMigrationInstructionKind|undefined=>
  sameDiscriminator(value,PUMP_MIGRATE_DISCRIMINATOR)?'MIGRATE':
  sameDiscriminator(value,PUMP_MIGRATE_V2_DISCRIMINATOR)?'MIGRATE_V2':
  undefined

export function verifyPumpMigration(input:PumpMigrationVerificationInput):VerifiedPumpMigration{
  if(!input.migrationId.trim()||!input.baseMint.trim()||!input.bondingCurveAddress.trim()||!input.pumpSwapPoolAddress.trim())throw new Error('pump_migration_verification_identity_required')
  if(Number.isNaN(Date.parse(input.observedAt)))throw new Error('pump_migration_verification_time_invalid')
  if(!input.evidenceIds.length)throw new Error('pump_migration_verification_evidence_required')
  if(input.pumpProgramId!==PUMP_PROGRAM_ID)throw new Error('pump_migration_program_invalid')
  const kind=instructionKind(input.instructionDiscriminator)
  if(!kind)throw new Error('pump_migration_instruction_invalid')
  if(input.bondingCurveComplete!==true)throw new Error('pump_migration_curve_incomplete')
  if(input.pumpSwapProgramId!==PUMPSWAP_AMM_PROGRAM_ID)throw new Error('pump_migration_destination_program_invalid')
  if(input.pumpSwapPoolIndex!==PUMP_CANONICAL_POOL_INDEX)throw new Error('pump_migration_noncanonical_pool_index')
  if(input.pumpSwapBaseMint!==input.baseMint)throw new Error('pump_migration_base_mint_mismatch')
  if(input.quoteMint&&input.pumpSwapQuoteMint&&input.quoteMint!==input.pumpSwapQuoteMint)throw new Error('pump_migration_quote_mint_mismatch')
  if(input.canonicalPoolCreatorVerified!==true)throw new Error('pump_migration_pool_creator_unverified')

  return Object.freeze({
    migrationId:input.migrationId,
    instructionKind:kind,
    observedAt:input.observedAt,
    baseMint:input.baseMint,
    quoteMint:input.quoteMint??input.pumpSwapQuoteMint,
    bondingCurveAddress:input.bondingCurveAddress,
    pumpSwapPoolAddress:input.pumpSwapPoolAddress,
    confidence:1,
    evidenceIds:Object.freeze([...new Set(input.evidenceIds)].sort()),
    authority:'EVIDENCE_ONLY',
    canAuthorizeTrade:false,
  })
}

export function pumpMigrationToGenericEvidence(input:VerifiedPumpMigration):TokenMigrationEvidence{
  return {
    migrationId:input.migrationId,
    oldToken:input.baseMint,
    newToken:input.baseMint,
    migrationProgram:PUMP_PROGRAM_ID,
    migrationObservedAt:input.observedAt,
    sourcePool:input.bondingCurveAddress,
    destinationPool:input.pumpSwapPoolAddress,
    evidenceIds:[...input.evidenceIds],
    confidence:input.confidence,
    kind:'POOL_MIGRATION',
  }
}
