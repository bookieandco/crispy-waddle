import { createHash } from 'node:crypto'
import type { SportsPredictionTransportEnvelope } from './sports-intelligence-ingress.js'
import type { SportsPredictionFeatureSnapshot } from './sports-prediction-features.js'
import type { SportsRealitySnapshot } from './sports-prediction-reality.js'
import type { SportsPredictionSimulation } from './sports-prediction-simulation.js'

export type SportsPredictionModelSpec=Readonly<{
  modelId:string
  modelVersion:string
  methodologyVersion:string
  featureSchemaVersion:string
  codeRevision:string
  frozenAt:string
  sport:string
  marketFamily:string
  authority:'MODEL_SPEC_ONLY'
  canExecute:false
}>

export type SportsPredictionCalibrationProfile=Readonly<{
  status:'UNCALIBRATED'|'CALIBRATING'|'CALIBRATED'
  sampleSize:number
  brierScore?:number
  expectedCalibrationError?:number
  evaluatedAt?:string
  calibrationModelVersion?:string
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}
const instant=(v:string,c:string)=>{nonEmpty(v,c);const n=Date.parse(v);if(Number.isNaN(n))throw new Error(c);return n}
const unit=(v:number,c:string)=>{if(!Number.isFinite(v)||v<0||v>1)throw new Error(c)}

export function assertFrozenSportsPredictionModel(spec:SportsPredictionModelSpec,cutoff:string):void{
  nonEmpty(spec.modelId,'SPORT_PRED_MODEL_ID_REQUIRED')
  nonEmpty(spec.modelVersion,'SPORT_PRED_MODEL_VERSION_REQUIRED')
  nonEmpty(spec.methodologyVersion,'SPORT_PRED_MODEL_METHOD_REQUIRED')
  nonEmpty(spec.featureSchemaVersion,'SPORT_PRED_MODEL_FEATURE_SCHEMA_REQUIRED')
  nonEmpty(spec.codeRevision,'SPORT_PRED_MODEL_CODE_REVISION_REQUIRED')
  const frozen=instant(spec.frozenAt,'SPORT_PRED_MODEL_FROZEN_AT_INVALID')
  const cutoffMs=instant(cutoff,'SPORT_PRED_MODEL_CUTOFF_INVALID')
  if(frozen>cutoffMs)throw new Error('SPORT_PRED_MODEL_NOT_FROZEN_BEFORE_CUTOFF')
  if(spec.authority!=='MODEL_SPEC_ONLY'||spec.canExecute!==false)throw new Error('SPORT_PRED_MODEL_AUTHORITY_INVALID')
}

export function buildSportsPredictionEnvelope(input:{
  reality:SportsRealitySnapshot
  features:SportsPredictionFeatureSnapshot
  simulation:SportsPredictionSimulation
  model:SportsPredictionModelSpec
  calibration:SportsPredictionCalibrationProfile
  issuedAt:string
  resolution:Readonly<{type:string;authority:string;ruleVersion:string;resolutionDeadlineAt?:string}>
  subjectKind?:string
}):SportsPredictionTransportEnvelope{
  const cutoff=input.reality.informationCutoff
  assertFrozenSportsPredictionModel(input.model,cutoff)
  const issued=instant(input.issuedAt,'SPORT_PRED_ENVELOPE_ISSUED_AT_INVALID')
  const cutoffMs=instant(cutoff,'SPORT_PRED_ENVELOPE_CUTOFF_INVALID')
  if(issued<cutoffMs)throw new Error('SPORT_PRED_ENVELOPE_ISSUED_BEFORE_CUTOFF')
  if(input.features.eventId!==input.reality.eventId||input.features.realitySnapshotId!==input.reality.snapshotId)throw new Error('SPORT_PRED_ENVELOPE_FEATURE_REALITY_MISMATCH')
  if(input.simulation.eventId!==input.reality.eventId||input.simulation.featureSnapshotId!==input.features.featureSnapshotId)throw new Error('SPORT_PRED_ENVELOPE_SIMULATION_MISMATCH')
  if(input.simulation.modelId!==input.model.modelId||input.simulation.modelVersion!==input.model.modelVersion)throw new Error('SPORT_PRED_ENVELOPE_MODEL_MISMATCH')
  if(input.model.sport!==input.reality.sport)throw new Error('SPORT_PRED_ENVELOPE_SPORT_MISMATCH')
  if(input.features.informationCutoff!==cutoff)throw new Error('SPORT_PRED_ENVELOPE_FEATURE_CUTOFF_MISMATCH')
  if(!Number.isInteger(input.calibration.sampleSize)||input.calibration.sampleSize<0)throw new Error('SPORT_PRED_ENVELOPE_CALIBRATION_SAMPLE_INVALID')
  if(input.calibration.brierScore!==undefined)unit(input.calibration.brierScore,'SPORT_PRED_ENVELOPE_BRIER_INVALID')
  if(input.calibration.expectedCalibrationError!==undefined)unit(input.calibration.expectedCalibrationError,'SPORT_PRED_ENVELOPE_ECE_INVALID')
  if(input.calibration.evaluatedAt&&instant(input.calibration.evaluatedAt,'SPORT_PRED_ENVELOPE_CALIBRATION_TIME_INVALID')>cutoffMs)throw new Error('SPORT_PRED_ENVELOPE_CALIBRATION_FUTURE_LEAK')
  nonEmpty(input.resolution.type,'SPORT_PRED_ENVELOPE_RESOLUTION_TYPE_REQUIRED')
  nonEmpty(input.resolution.authority,'SPORT_PRED_ENVELOPE_RESOLUTION_AUTHORITY_REQUIRED')
  nonEmpty(input.resolution.ruleVersion,'SPORT_PRED_ENVELOPE_RESOLUTION_RULE_REQUIRED')

  const evidenceRefs=[
    ...input.reality.observations.map(o=>Object.freeze({
      evidenceId:'reality:'+o.observationId,
      sourceType:'SPORTS_REALITY:'+o.kind,
      locator:o.sourceLocator,
      observedAt:o.observedAt,
    })),
    ...input.features.features.map(f=>Object.freeze({
      evidenceId:'feature:'+f.featureId,
      sourceType:'SPORTS_FEATURE:'+f.family,
      observedAt:f.observedAt,
    })),
  ]
  const evidenceSnapshotHash=hash(evidenceRefs.map(e=>[e.evidenceId,e.observedAt]).sort())
  const inputSnapshotHash=hash({
    reality:input.reality.snapshotHash,
    features:input.features.featureSnapshotHash,
    simulation:input.simulation.provenanceHash,
    model:[input.model.modelId,input.model.modelVersion,input.model.codeRevision],
  })
  const envelopeId='sport-pred:'+hash({inputSnapshotHash,evidenceSnapshotHash,issuedAt:input.issuedAt})
  return Object.freeze({
    schemaVersion:'SPORT-PRED-01',
    envelopeId,
    sport:input.reality.sport,
    subject:Object.freeze({
      subjectId:input.reality.eventId,
      kind:input.subjectKind??'EVENT',
      gameId:input.reality.eventId,
    }),
    informationCutoff:cutoff,
    issuedAt:input.issuedAt,
    model:Object.freeze({
      modelId:input.model.modelId,
      modelVersion:input.model.modelVersion,
      methodologyVersion:input.model.methodologyVersion,
      featureSnapshotHash:input.features.featureSnapshotHash,
      codeRevision:input.model.codeRevision,
    }),
    distribution:Object.freeze({
      outcomes:Object.freeze(input.simulation.outcomes.map(o=>Object.freeze({
        outcomeId:o.outcomeId,
        label:o.outcomeId,
        probability:o.probability,
        metadata:Object.freeze({scenarioId:input.simulation.scenarioId,pathCount:input.simulation.pathCount}),
      }))),
    }),
    calibration:Object.freeze({
      status:input.calibration.status,
      sampleSize:input.calibration.sampleSize,
      brierScore:input.calibration.brierScore,
      evaluatedAt:input.calibration.evaluatedAt,
      calibrationModelVersion:input.calibration.calibrationModelVersion,
    }),
    uncertainty:Object.freeze({
      aleatoric:input.simulation.aleatoricUncertainty,
      epistemic:input.simulation.epistemicUncertainty,
      overall:input.simulation.overallUncertainty,
      notes:Object.freeze(['Scenario simulation is replayable by randomSeed/pathCount; uncertainty is evidence, not execution authority.']),
    }),
    resolution:Object.freeze({...input.resolution}),
    evidenceRefs:Object.freeze(evidenceRefs),
    provenance:Object.freeze({
      inputSnapshotHash,
      evidenceSnapshotHash,
      generatedBy:'SPORT-PRED.FINAL',
    }),
    allowedUses:Object.freeze(['MONEY_RESEARCH_INPUT','COACHING_RESEARCH']),
    authority:Object.freeze({
      decision:'INTELLIGENCE_ONLY',
      coachingExecution:'NONE',
      bettingExecution:'NONE',
      financialExecution:'NONE',
    }),
  })
}
