import { createHash } from 'node:crypto'
import type { SportsBetShadowSoakCertification } from './sports-bet-shadow-runtime.js'
import type { SportsBetLiveCanaryCertification } from './sports-bet-live-canary.js'

export type SportsBetFinalSoftwareCaseName=
  |'prediction-authority-isolated'
  |'shadow-never-executes'
  |'quote-freshness-enforced'
  |'future-quote-blocked'
  |'manual-live-trigger-required'
  |'canary-stake-capped'
  |'jurisdiction-and-age-gated'
  |'credential-verification-required'
  |'idempotency-replay-blocked'
  |'unknown-execution-blocks-new-canary'
  |'settlement-reconciliation-required'
  |'kill-switch-required'
  |'synthetic-evidence-cannot-certify-live'

export type SportsBetFinalSoftwareCase=Readonly<{
  caseId:string
  name:SportsBetFinalSoftwareCaseName
  passed:boolean
  evidenceIds:readonly string[]
}>

export type SportsBetFinalSoftwareCertification=Readonly<{
  certificationId:string
  passed:boolean
  status:'SOFTWARE_COMPLETE'|'BLOCKED'
  requiredCases:readonly SportsBetFinalSoftwareCaseName[]
  failedCases:readonly SportsBetFinalSoftwareCaseName[]
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

export type SportsBetFinalReport=Readonly<{
  reportId:string
  softwarePassed:boolean
  shadowOperationallyCertified:boolean
  liveCanaryCertified:boolean
  status:'BLOCKED_SOFTWARE'|'SOFTWARE_COMPLETE_EXTERNAL_COMMISSIONING_REQUIRED'|'SHADOW_CERTIFIED_LIVE_CANARY_REQUIRED'|'LIVE_CANARY_AND_SHADOW_CERTIFIED'
  productionAutonomousBettingEnabled:false
  canIncreaseCanaryLimits:false
  blockers:readonly string[]
  evidenceIds:readonly string[]
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

const required:readonly SportsBetFinalSoftwareCaseName[]=Object.freeze([
  'prediction-authority-isolated','shadow-never-executes','quote-freshness-enforced','future-quote-blocked','manual-live-trigger-required','canary-stake-capped',
  'jurisdiction-and-age-gated','credential-verification-required','idempotency-replay-blocked','unknown-execution-blocks-new-canary','settlement-reconciliation-required',
  'kill-switch-required','synthetic-evidence-cannot-certify-live',
])
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function certifySportsBetFinalSoftware(cases:readonly SportsBetFinalSoftwareCase[]):SportsBetFinalSoftwareCertification{
  const passedNames=new Set(cases.filter(x=>x.passed).map(x=>x.name))
  const failedCases=required.filter(x=>!passedNames.has(x))
  const duplicateNames=cases.length-new Set(cases.map(x=>x.name)).size
  const invalidEvidence=cases.some(x=>!x.caseId.trim()||!x.evidenceIds.length)
  const passed=failedCases.length===0&&!duplicateNames&&!invalidEvidence&&cases.every(x=>x.passed)
  return Object.freeze({
    certificationId:'sport-bet-software:'+hash({cases,required}),passed,status:passed?'SOFTWARE_COMPLETE':'BLOCKED',requiredCases:required,failedCases:Object.freeze([...failedCases]),
    authority:'CERTIFICATION_ONLY',canExecute:false,
  })
}

export function certifySportsBetFinal(input:{
  software:SportsBetFinalSoftwareCertification
  shadow:SportsBetShadowSoakCertification
  liveCanary:SportsBetLiveCanaryCertification
}):SportsBetFinalReport{
  const blockers:string[]=[]
  if(!input.software.passed)blockers.push('SOFTWARE_CERTIFICATION_REQUIRED')
  if(!input.shadow.operationallyCertified)blockers.push('REAL_AS_OF_SHADOW_SOAK_REQUIRED')
  if(!input.liveCanary.liveCanaryCertified)blockers.push('REAL_LIVE_CANARY_REQUIRED')
  let status:SportsBetFinalReport['status']
  if(!input.software.passed)status='BLOCKED_SOFTWARE'
  else if(input.shadow.operationallyCertified&&input.liveCanary.liveCanaryCertified)status='LIVE_CANARY_AND_SHADOW_CERTIFIED'
  else if(input.shadow.operationallyCertified)status='SHADOW_CERTIFIED_LIVE_CANARY_REQUIRED'
  else status='SOFTWARE_COMPLETE_EXTERNAL_COMMISSIONING_REQUIRED'
  return Object.freeze({
    reportId:'sport-bet-final:'+hash({software:input.software.certificationId,shadow:input.shadow.certificationId,liveCanary:input.liveCanary.certificateId}),
    softwarePassed:input.software.passed,shadowOperationallyCertified:input.shadow.operationallyCertified,liveCanaryCertified:input.liveCanary.liveCanaryCertified,status,
    productionAutonomousBettingEnabled:false,canIncreaseCanaryLimits:false,blockers:unique(blockers),evidenceIds:unique([...input.shadow.evidenceIds,...input.liveCanary.evidenceIds]),
    authority:'CERTIFICATION_ONLY',canExecute:false,
  })
}
