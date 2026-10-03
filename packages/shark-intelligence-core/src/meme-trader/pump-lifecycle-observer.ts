import {
  buildPumpMigrationRadarCandidate,
  type PumpMigrationObservation,
  type PumpMigrationRadarCandidate,
} from './migration-radar'
import {
  pumpMigrationToGenericEvidence,
  verifyPumpMigration,
  type PumpMigrationVerificationInput,
  type VerifiedPumpMigration,
} from './pump-migration-verifier'
import type {TokenMigrationEvidence} from './migration-classification'

export type PumpLifecycleObservationInput=Readonly<{
  observation:PumpMigrationObservation
  migration?:PumpMigrationVerificationInput
}>

export type PumpLifecycleObservationResult=Readonly<{
  radar:PumpMigrationRadarCandidate
  verifiedMigration?:VerifiedPumpMigration
  genericMigrationEvidence?:TokenMigrationEvidence
  authority:'EVIDENCE_AND_RESEARCH_ONLY'
  canAuthorizeTrade:false
}>

/**
 * Canonical Pump lifecycle composition.
 *
 * Provider adapters are responsible only for supplying point-in-time evidence.
 * This function owns the transition from raw curve/pool observations to
 * verified migration evidence and then to a research-only radar candidate.
 */
export function observePumpLifecycle(input:PumpLifecycleObservationInput):PumpLifecycleObservationResult{
  let observation=input.observation
  let verifiedMigration:VerifiedPumpMigration|undefined
  let genericMigrationEvidence:TokenMigrationEvidence|undefined

  if(input.migration){
    verifiedMigration=verifyPumpMigration(input.migration)
    if(verifiedMigration.baseMint!==observation.mint)throw new Error('pump_lifecycle_migration_mint_mismatch')
    if(!observation.bondingCurveAddress)throw new Error('pump_lifecycle_curve_binding_required')
    if(verifiedMigration.bondingCurveAddress!==observation.bondingCurveAddress)throw new Error('pump_lifecycle_curve_binding_invalid')
    if(observation.quoteMint&&verifiedMigration.quoteMint&&observation.quoteMint!==verifiedMigration.quoteMint)throw new Error('pump_lifecycle_quote_binding_invalid')
    genericMigrationEvidence=pumpMigrationToGenericEvidence(verifiedMigration)
    observation=Object.freeze({
      ...observation,
      quoteMint:observation.quoteMint??verifiedMigration.quoteMint,
      complete:true,
      pumpSwapPoolAddress:verifiedMigration.pumpSwapPoolAddress,
      pumpSwapPoolVerified:true,
      evidenceIds:Object.freeze([...new Set([...observation.evidenceIds,...verifiedMigration.evidenceIds])].sort()),
    })
  }

  return Object.freeze({
    radar:buildPumpMigrationRadarCandidate(observation),
    verifiedMigration,
    genericMigrationEvidence,
    authority:'EVIDENCE_AND_RESEARCH_ONLY',
    canAuthorizeTrade:false,
  })
}
