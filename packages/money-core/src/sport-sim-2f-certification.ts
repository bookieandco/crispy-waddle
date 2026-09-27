import { createHash } from 'node:crypto'

export const SPORT_SIM_2F_VERSION='SPORT-SIM.2F' as const

export type SportSim2FCertificationCase=Readonly<{
  name:string
  passed:boolean
  evidenceIds:readonly string[]
}>

export type SportSim2FCertificationReport=Readonly<{
  reportId:string
  version:typeof SPORT_SIM_2F_VERSION
  cases:readonly SportSim2FCertificationCase[]
  softwarePassed:boolean
  causalSimulatorReady:boolean
  liveResimulationReady:boolean
  paperCoreAutomationReady:boolean
  empiricalEdgeCertified:false
  liveBettingEligible:false
  requiredExternalEvidence:readonly string[]
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

const required=[
  'causal-slider-impact',
  'stress-override-separated',
  'sport-specific-state-transitions',
  'correlated-monte-carlo',
  'fat-tail-regime',
  'player-stat-and-tail-distributions',
  'same-path-joint-probability',
  'live-resimulation-deltas',
  'slider-ablation-and-sensitivity',
  'synthetic-cannot-certify-edge',
  'bet-alpha-ranking',
  'papercore-automatic-wagering',
  'open-position-reunderwriting',
  'cross-domain-alpha-intelligence-only',
  'roboflow-context-only',
  'no-live-execution-authority',
] as const

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')

export function certifySportSim2FSoftware(input:{
  cases:readonly SportSim2FCertificationCase[]
}):SportSim2FCertificationReport{
  const passed=new Set(input.cases.filter(c=>c.passed).map(c=>c.name))
  const missing=required.filter(name=>!passed.has(name))
  const allEvidence=input.cases.every(c=>c.evidenceIds.length>0)
  const softwarePassed=missing.length===0&&allEvidence&&input.cases.every(c=>c.passed)
  return Object.freeze({
    reportId:'sport-sim-2f:'+hash({cases:input.cases,missing}),
    version:SPORT_SIM_2F_VERSION,
    cases:Object.freeze([...input.cases]),
    softwarePassed,
    causalSimulatorReady:softwarePassed,
    liveResimulationReady:softwarePassed,
    paperCoreAutomationReady:softwarePassed,
    empiricalEdgeCertified:false,
    liveBettingEligible:false,
    requiredExternalEvidence:Object.freeze([
      'REAL_AS_OF sport-specific slider impact estimates and ablation cohorts',
      'REAL_AS_OF market/tail/joint calibration observations',
      'Live game-state feeds with point-in-time timestamps',
      'Real sportsbook/prediction-market quotes for execution-quality comparison',
      'Forward-shadow soak before any separate live execution admission',
    ]),
    authority:'CERTIFICATION_ONLY',
    canExecute:false,
  })
}
