import { createHash } from 'node:crypto'

export const SPORT_PRED_FINAL_VERSION='SPORT-PRED.FINAL' as const

export type SportsPredFinalCertificationCase=Readonly<{
  name:string
  passed:boolean
  evidenceIds:readonly string[]
}>

export type SportsPredFinalSoftwareReport=Readonly<{
  reportId:string
  version:typeof SPORT_PRED_FINAL_VERSION
  cases:readonly SportsPredFinalCertificationCase[]
  softwarePassed:boolean
  forwardShadowHarnessReady:boolean
  statisticalEdgeCertified:false
  liveBettingEligible:false
  requiredExternalEvidence:readonly string[]
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

const required=[
  'point-in-time-reality',
  'future-observation-exclusion',
  'cutoff-safe-feature-snapshot',
  'narrative-context-only',
  'replayable-scenario-simulation',
  'frozen-model-version',
  'valid-sport-pred-envelope',
  'money-research-only-boundary',
  'pre-resolution-shadow-prediction',
  'quote-before-information-cutoff',
  'full-issued-history-retained',
  'model-mutation-new-cohort',
  'sport-market-specific-model-arena',
  'synthetic-cannot-certify-edge',
  'no-betting-or-financial-authority',
] as const

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')

export function certifySportsPredFinalSoftware(input:{
  cases:readonly SportsPredFinalCertificationCase[]
}):SportsPredFinalSoftwareReport{
  const passedNames=new Set(input.cases.filter(c=>c.passed).map(c=>c.name))
  const missing=required.filter(name=>!passedNames.has(name))
  const allEvidence=input.cases.every(c=>c.evidenceIds.length>0)
  const softwarePassed=missing.length===0&&allEvidence&&input.cases.every(c=>c.passed)
  return Object.freeze({
    reportId:'sport-pred-final:'+hash({cases:input.cases,missing}),
    version:SPORT_PRED_FINAL_VERSION,
    cases:Object.freeze([...input.cases]),
    softwarePassed,
    forwardShadowHarnessReady:softwarePassed,
    statisticalEdgeCertified:false,
    liveBettingEligible:false,
    requiredExternalEvidence:Object.freeze([
      'Immutable REAL_AS_OF predictions timestamped before resolution',
      'A complete cohort including losing and unresolved predictions',
      'A fixed model/version cohort with mutations split into a new cohort',
      'Real closing-price/odds evidence when economic-edge certification is requested',
      'Enough distinct resolved events and elapsed forward time to satisfy configured thresholds',
    ]),
    authority:'CERTIFICATION_ONLY',
    canExecute:false,
  })
}
