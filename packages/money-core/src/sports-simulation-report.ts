import { createHash } from 'node:crypto'
import type { CorrelatedSportsSimulation, SportsDistributionSummary } from './sports-correlated-monte-carlo.js'

export const NBA2K_STATS_REFERENCE=Object.freeze({
  repository:'https://github.com/rkadlick/nba2k-stats',
  auditedCommit:'e2514b7e2a57d9f143ecafef8f0844e0421791e3',
  license:'MIT',
  use:'STAT_LEDGER_AND_PRESENTATION_REFERENCE_ONLY',
  authority:'REFERENCE_ONLY',
} as const)

export type SportsVideoGameReferenceProfile=Readonly<{
  profileId:string
  gameVersion:string
  playerLabel:string
  position?:string
  height?:number
  weight?:number
  archetype?:string
  rosterOverall?:number
  observedAt:string
  evidenceIds:readonly string[]
  sourceClass:'VIDEO_GAME_REFERENCE'
  realWorldTruth:false
  calibrationEligible:false
  authority:'CONTEXT_ONLY'
  canExecute:false
}>

export type SportsSimulationRequestedStat=Readonly<{
  statId:string
  label:string
}>

export type SportsSimulationReport=Readonly<{
  reportId:string
  eventId:string
  eventLabel:string
  sport:string
  simulationId:string
  pathCount:number
  randomSeed:string
  score:Readonly<{
    home:SportsDistributionSummary
    away:SportsDistributionSummary
    margin:SportsDistributionSummary
    total:SportsDistributionSummary
  }>
  requestedPlayerStats:readonly Readonly<{
    statId:string
    playerId:string
    label:string
    summary:SportsDistributionSummary
    tailProbabilityByThreshold:Readonly<Record<string,number>>
  }>[]
  marketProbabilities:readonly Readonly<{legId:string;probability:number}>[]
  jointProbabilities:readonly Readonly<{jointId:string;legIds:readonly string[];probability:number}>[]
  assumptions:readonly string[]
  scenarioNotes:readonly string[]
  warnings:readonly string[]
  videoGameReferenceProfiles:readonly SportsVideoGameReferenceProfile[]
  authority:'INTELLIGENCE_ONLY'
  bettingAuthority:'NONE'
  financialAuthority:'NONE'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function assertSportsVideoGameReferenceProfile(p:SportsVideoGameReferenceProfile):void{
  if(!p.profileId.trim()||!p.gameVersion.trim()||!p.playerLabel.trim()||!p.evidenceIds.length)throw new Error('SPORT_SIM_2K_PROFILE_LINEAGE_REQUIRED')
  if(Number.isNaN(Date.parse(p.observedAt)))throw new Error('SPORT_SIM_2K_PROFILE_TIME_INVALID')
  if(p.rosterOverall!==undefined&&(!Number.isInteger(p.rosterOverall)||p.rosterOverall<0||p.rosterOverall>100))throw new Error('SPORT_SIM_2K_PROFILE_OVERALL_INVALID')
  if(p.height!==undefined&&(!Number.isFinite(p.height)||p.height<=0))throw new Error('SPORT_SIM_2K_PROFILE_HEIGHT_INVALID')
  if(p.weight!==undefined&&(!Number.isFinite(p.weight)||p.weight<=0))throw new Error('SPORT_SIM_2K_PROFILE_WEIGHT_INVALID')
  if(p.sourceClass!=='VIDEO_GAME_REFERENCE'||p.realWorldTruth!==false||p.calibrationEligible!==false||p.authority!=='CONTEXT_ONLY'||p.canExecute!==false)throw new Error('SPORT_SIM_2K_PROFILE_AUTHORITY_INVALID')
}

export function buildSportsSimulationReport(input:{
  eventLabel:string
  simulation:CorrelatedSportsSimulation
  requestedStats?:readonly SportsSimulationRequestedStat[]
  assumptions?:readonly string[]
  scenarioNotes?:readonly string[]
  warnings?:readonly string[]
  videoGameReferenceProfiles?:readonly SportsVideoGameReferenceProfile[]
}):SportsSimulationReport{
  if(!input.eventLabel.trim())throw new Error('SPORT_SIM_REPORT_EVENT_LABEL_REQUIRED')
  const requested=input.requestedStats??input.simulation.playerStats.map(p=>({statId:p.statId,label:p.statId}))
  const requestedIds=new Set(requested.map(x=>x.statId))
  if(requestedIds.size!==requested.length)throw new Error('SPORT_SIM_REPORT_DUPLICATE_STAT')
  const profiles=input.videoGameReferenceProfiles??[]
  for(const p of profiles)assertSportsVideoGameReferenceProfile(p)
  const stats=requested.map(r=>{
    const found=input.simulation.playerStats.find(p=>p.statId===r.statId)
    if(!found)throw new Error('SPORT_SIM_REPORT_STAT_NOT_SIMULATED:'+r.statId)
    return Object.freeze({
      statId:found.statId,
      playerId:found.playerId,
      label:r.label,
      summary:found.summary,
      tailProbabilityByThreshold:found.tailProbabilityByThreshold,
    })
  })
  return Object.freeze({
    reportId:'sport-sim-report:'+hash({eventLabel:input.eventLabel,simulationId:input.simulation.simulationId,requested:[...requestedIds].sort(),scenarioNotes:input.scenarioNotes??[]}),
    eventId:input.simulation.eventId,
    eventLabel:input.eventLabel,
    sport:input.simulation.sport,
    simulationId:input.simulation.simulationId,
    pathCount:input.simulation.pathCount,
    randomSeed:input.simulation.randomSeed,
    score:Object.freeze({
      home:input.simulation.homeScore,
      away:input.simulation.awayScore,
      margin:input.simulation.margin,
      total:input.simulation.total,
    }),
    requestedPlayerStats:Object.freeze(stats),
    marketProbabilities:Object.freeze([...input.simulation.marketProbabilities]),
    jointProbabilities:Object.freeze([...input.simulation.jointProbabilities]),
    assumptions:unique(input.assumptions??[]),
    scenarioNotes:unique(input.scenarioNotes??[]),
    warnings:unique([
      'Simulation output is probabilistic, not a guarantee.',
      'Video-game reference profiles are context-only and cannot certify real-world edge.',
      ...(input.warnings??[]),
    ]),
    videoGameReferenceProfiles:Object.freeze([...profiles]),
    authority:'INTELLIGENCE_ONLY',
    bettingAuthority:'NONE',
    financialAuthority:'NONE',
    canExecute:false,
  })
}

function pct(p:number):string{return (p*100).toFixed(1)+'%'}
function n(v:number):string{return Number.isInteger(v)?String(v):v.toFixed(1)}
function dist(label:string,d:SportsDistributionSummary):string{
  return label+': mean '+n(d.mean)+' | median '+n(d.p50)+' | P10–P90 '+n(d.p10)+'–'+n(d.p90)
}

export function renderSportsSimulationReportText(report:SportsSimulationReport):string{
  const lines=[
    report.eventLabel+' — '+report.pathCount.toLocaleString()+' simulations',
    dist('Home score',report.score.home),
    dist('Away score',report.score.away),
    dist('Margin',report.score.margin),
    dist('Total',report.score.total),
  ]
  for(const p of report.marketProbabilities)lines.push(p.legId+': '+pct(p.probability))
  for(const s of report.requestedPlayerStats){
    lines.push(dist(s.label,s.summary))
    for(const [threshold,probability] of Object.entries(s.tailProbabilityByThreshold))lines.push('  '+s.label+' > '+threshold+': '+pct(probability))
  }
  for(const j of report.jointProbabilities)lines.push(j.jointId+' ('+j.legIds.join(' + ')+'): '+pct(j.probability))
  if(report.assumptions.length)lines.push('Assumptions: '+report.assumptions.join('; '))
  if(report.scenarioNotes.length)lines.push('Scenario: '+report.scenarioNotes.join('; '))
  if(report.warnings.length)lines.push('Limits: '+report.warnings.join(' '))
  return lines.join('\n')
}
