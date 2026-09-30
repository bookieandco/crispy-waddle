import { createHash } from 'node:crypto'
import type { SportsSimSport } from './sports-simulation-state.js'
import type { SportsSliderImpactAssessment } from './sports-simulation-slider-engine.js'

export type SportsLatentFactor=Readonly<{
  factorId:string
  mean:number
  stdDev:number
  evidenceIds:readonly string[]
}>

export type SportsTeamScoreModel=Readonly<{
  team:'HOME'|'AWAY'
  baseRemainingMean:number
  residualStdDev:number
  sensitivities:Readonly<Record<string,number>>
}>

export type SportsPlayerStatModel=Readonly<{
  statId:string
  playerId:string
  baseRemainingMean:number
  residualStdDev:number
  minimum:number
  maximum?:number
  sensitivities:Readonly<Record<string,number>>
  tailThresholds?:readonly number[]
}>

export type SportsSimMarketLeg=
  |Readonly<{legId:string;kind:'HOME_WIN'}>
  |Readonly<{legId:string;kind:'AWAY_WIN'}>
  |Readonly<{legId:string;kind:'HOME_COVER';line:number}>
  |Readonly<{legId:string;kind:'AWAY_COVER';line:number}>
  |Readonly<{legId:string;kind:'TOTAL_OVER';line:number}>
  |Readonly<{legId:string;kind:'TOTAL_UNDER';line:number}>
  |Readonly<{legId:string;kind:'PLAYER_OVER';statId:string;line:number}>
  |Readonly<{legId:string;kind:'PLAYER_UNDER';statId:string;line:number}>

export type SportsDistributionSummary=Readonly<{
  mean:number
  stdDev:number
  p10:number
  p25:number
  p50:number
  p75:number
  p90:number
}>

export type SportsPlayerDistribution=Readonly<{
  statId:string
  playerId:string
  summary:SportsDistributionSummary
  tailProbabilityByThreshold:Readonly<Record<string,number>>
}>

export type SportsMarketProbability=Readonly<{
  legId:string
  probability:number
}>

export type SportsJointProbability=Readonly<{
  jointId:string
  legIds:readonly string[]
  probability:number
}>

export type CorrelatedSportsSimulation=Readonly<{
  simulationId:string
  eventId:string
  sport:SportsSimSport
  randomSeed:string
  pathCount:number
  homeScore:SportsDistributionSummary
  awayScore:SportsDistributionSummary
  margin:SportsDistributionSummary
  total:SportsDistributionSummary
  playerStats:readonly SportsPlayerDistribution[]
  marketProbabilities:readonly SportsMarketProbability[]
  jointProbabilities:readonly SportsJointProbability[]
  latentFactorIds:readonly string[]
  sliderAssessmentId?:string
  heavyTailRegimeBps:number
  evidenceIds:readonly string[]
  authority:'SIMULATION_ONLY'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))
const unique=<T extends string>(xs:readonly T[])=>Object.freeze([...new Set(xs)].sort()) as readonly T[]

function seed32(seed:string):number{
  const h=createHash('sha256').update(seed).digest()
  return h.readUInt32LE(0)||1
}
function prng(seed:string):()=>number{
  let x=seed32(seed)
  return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}
}
function normal(next:()=>number):number{
  const u=Math.max(1e-12,next()),v=Math.max(1e-12,next())
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)
}
function mean(xs:readonly number[]):number{return xs.reduce((a,b)=>a+b,0)/xs.length}
function summary(xs:readonly number[]):SportsDistributionSummary{
  if(!xs.length)throw new Error('SPORT_SIM_DISTRIBUTION_EMPTY')
  const sorted=[...xs].sort((a,b)=>a-b)
  const m=mean(sorted)
  const variance=mean(sorted.map(x=>(x-m)**2))
  const q=(p:number)=>sorted[Math.min(sorted.length-1,Math.max(0,Math.floor((sorted.length-1)*p)))]!
  return Object.freeze({mean:m,stdDev:Math.sqrt(variance),p10:q(.10),p25:q(.25),p50:q(.50),p75:q(.75),p90:q(.90)})
}
function assertModelValue(v:number,c:string){if(!Number.isFinite(v))throw new Error(c)}
function evalLeg(leg:SportsSimMarketLeg,path:{home:number;away:number;stats:Readonly<Record<string,number>>}):boolean{
  const margin=path.home-path.away,total=path.home+path.away
  switch(leg.kind){
    case 'HOME_WIN':return margin>0
    case 'AWAY_WIN':return margin<0
    case 'HOME_COVER':return margin+leg.line>0
    case 'AWAY_COVER':return -margin+leg.line>0
    case 'TOTAL_OVER':return total>leg.line
    case 'TOTAL_UNDER':return total<leg.line
    case 'PLAYER_OVER':return (path.stats[leg.statId]??Number.NaN)>leg.line
    case 'PLAYER_UNDER':return (path.stats[leg.statId]??Number.NaN)<leg.line
  }
}

export function latentFactorsFromSliders(input:{
  assessment:SportsSliderImpactAssessment
  baseStdDev?:number
}):readonly SportsLatentFactor[]{
  const std=input.baseStdDev??.35
  if(!Number.isFinite(std)||std<0)throw new Error('SPORT_SIM_LATENT_STD_INVALID')
  return Object.freeze(input.assessment.sliders.map(s=>Object.freeze({
    factorId:'SLIDER:'+s.slider,
    mean:s.effectiveValue,
    stdDev:std,
    evidenceIds:s.evidenceIds,
  })))
}

export function runCorrelatedSportsMonteCarlo(input:{
  eventId:string
  sport:SportsSimSport
  currentHomeScore:number
  currentAwayScore:number
  pathCount:number
  randomSeed:string
  teamModels:readonly SportsTeamScoreModel[]
  playerModels?:readonly SportsPlayerStatModel[]
  latentFactors:readonly SportsLatentFactor[]
  marketLegs?:readonly SportsSimMarketLeg[]
  jointSets?:readonly Readonly<{jointId:string;legIds:readonly string[]}>[]
  heavyTailRegimeBps?:number
  sliderAssessment?:SportsSliderImpactAssessment
}):CorrelatedSportsSimulation{
  if(!input.eventId.trim()||!input.randomSeed.trim())throw new Error('SPORT_SIM_CORRELATED_IDENTITY_REQUIRED')
  if(!Number.isInteger(input.pathCount)||input.pathCount<500)throw new Error('SPORT_SIM_CORRELATED_PATH_COUNT_TOO_LOW')
  for(const v of [input.currentHomeScore,input.currentAwayScore])assertModelValue(v,'SPORT_SIM_CORRELATED_SCORE_INVALID')
  if(input.teamModels.length!==2||new Set(input.teamModels.map(m=>m.team)).size!==2)throw new Error('SPORT_SIM_CORRELATED_TEAM_MODELS_INVALID')
  const tail=input.heavyTailRegimeBps??500
  if(!Number.isInteger(tail)||tail<0||tail>5000)throw new Error('SPORT_SIM_CORRELATED_TAIL_BPS_INVALID')
  const factorIds=new Set<string>()
  for(const f of input.latentFactors){
    if(!f.factorId.trim()||!f.evidenceIds.length)throw new Error('SPORT_SIM_CORRELATED_FACTOR_LINEAGE_REQUIRED')
    assertModelValue(f.mean,'SPORT_SIM_CORRELATED_FACTOR_MEAN_INVALID');assertModelValue(f.stdDev,'SPORT_SIM_CORRELATED_FACTOR_STD_INVALID')
    if(f.stdDev<0||factorIds.has(f.factorId))throw new Error('SPORT_SIM_CORRELATED_FACTOR_INVALID')
    factorIds.add(f.factorId)
  }
  for(const m of input.teamModels){
    assertModelValue(m.baseRemainingMean,'SPORT_SIM_CORRELATED_TEAM_MEAN_INVALID');assertModelValue(m.residualStdDev,'SPORT_SIM_CORRELATED_TEAM_STD_INVALID')
    if(m.baseRemainingMean<0||m.residualStdDev<0)throw new Error('SPORT_SIM_CORRELATED_TEAM_MODEL_INVALID')
  }
  const playerModels=input.playerModels??[]
  const statIds=new Set<string>()
  for(const p of playerModels){
    if(!p.statId.trim()||!p.playerId.trim()||statIds.has(p.statId))throw new Error('SPORT_SIM_CORRELATED_PLAYER_MODEL_INVALID')
    statIds.add(p.statId)
    if(p.baseRemainingMean<0||p.residualStdDev<0||p.minimum<0||p.maximum!==undefined&&p.maximum<p.minimum)throw new Error('SPORT_SIM_CORRELATED_PLAYER_RANGE_INVALID')
  }
  const legs=input.marketLegs??[]
  const legIds=new Set<string>()
  for(const l of legs){
    if(!l.legId.trim()||legIds.has(l.legId))throw new Error('SPORT_SIM_CORRELATED_LEG_INVALID')
    legIds.add(l.legId)
    if(('statId' in l)&&!statIds.has(l.statId))throw new Error('SPORT_SIM_CORRELATED_LEG_UNKNOWN_STAT')
  }
  for(const j of input.jointSets??[]){
    if(!j.jointId.trim()||j.legIds.length<2||j.legIds.some(id=>!legIds.has(id)))throw new Error('SPORT_SIM_CORRELATED_JOINT_INVALID')
  }

  const next=prng(input.randomSeed)
  const homeSamples:number[]=[],awaySamples:number[]=[],marginSamples:number[]=[],totalSamples:number[]=[]
  const statSamples=new Map<string,number[]>()
  const legHits=new Map<string,number>(legs.map(l=>[l.legId,0]))
  const jointHits=new Map<string,number>((input.jointSets??[]).map(j=>[j.jointId,0]))
  const homeModel=input.teamModels.find(m=>m.team==='HOME')!,awayModel=input.teamModels.find(m=>m.team==='AWAY')!

  for(let i=0;i<input.pathCount;i++){
    const factorDraws:Record<string,number>={}
    const tailRegime=next()<tail/10000
    const tailScale=tailRegime?2.75:1
    for(const f of input.latentFactors)factorDraws[f.factorId]=f.mean+f.stdDev*normal(next)*tailScale
    const scoreFor=(m:SportsTeamScoreModel)=>{
      let mu=m.baseRemainingMean
      for(const [factor,sensitivity] of Object.entries(m.sensitivities))mu+=(factorDraws[factor]??0)*sensitivity
      return Math.max(0,Math.round(mu+m.residualStdDev*normal(next)*tailScale))
    }
    const home=input.currentHomeScore+scoreFor(homeModel),away=input.currentAwayScore+scoreFor(awayModel)
    homeSamples.push(home);awaySamples.push(away);marginSamples.push(home-away);totalSamples.push(home+away)
    const stats:Record<string,number>={}
    for(const p of playerModels){
      let mu=p.baseRemainingMean
      for(const [factor,sensitivity] of Object.entries(p.sensitivities))mu+=(factorDraws[factor]??0)*sensitivity
      const value=clamp(mu+p.residualStdDev*normal(next)*tailScale,p.minimum,p.maximum??Number.POSITIVE_INFINITY)
      stats[p.statId]=value
      const bucket=statSamples.get(p.statId)??[];bucket.push(value);statSamples.set(p.statId,bucket)
    }
    const path={home,away,stats}
    const hitMap=new Map<string,boolean>()
    for(const l of legs){const hit=evalLeg(l,path);hitMap.set(l.legId,hit);if(hit)legHits.set(l.legId,(legHits.get(l.legId)??0)+1)}
    for(const j of input.jointSets??[]){if(j.legIds.every(id=>hitMap.get(id)===true))jointHits.set(j.jointId,(jointHits.get(j.jointId)??0)+1)}
  }

  const playerStats=playerModels.map(p=>{
    const xs=statSamples.get(p.statId)!
    const tails:Record<string,number>={}
    for(const t of p.tailThresholds??[])tails[String(t)]=xs.filter(x=>x>t).length/input.pathCount
    return Object.freeze({statId:p.statId,playerId:p.playerId,summary:summary(xs),tailProbabilityByThreshold:Object.freeze(tails)})
  })
  const evidenceIds=unique([
    ...input.latentFactors.flatMap(f=>f.evidenceIds),
    ...(input.sliderAssessment?.evidenceIds??[]),
  ])
  return Object.freeze({
    simulationId:'sport-correlated:'+hash({eventId:input.eventId,sport:input.sport,seed:input.randomSeed,pathCount:input.pathCount,teams:input.teamModels,players:playerModels,factors:input.latentFactors,legs,joints:input.jointSets??[]}),
    eventId:input.eventId,
    sport:input.sport,
    randomSeed:input.randomSeed,
    pathCount:input.pathCount,
    homeScore:summary(homeSamples),
    awayScore:summary(awaySamples),
    margin:summary(marginSamples),
    total:summary(totalSamples),
    playerStats:Object.freeze(playerStats),
    marketProbabilities:Object.freeze(legs.map(l=>Object.freeze({legId:l.legId,probability:(legHits.get(l.legId)??0)/input.pathCount}))),
    jointProbabilities:Object.freeze((input.jointSets??[]).map(j=>Object.freeze({jointId:j.jointId,legIds:Object.freeze([...j.legIds]),probability:(jointHits.get(j.jointId)??0)/input.pathCount}))),
    latentFactorIds:unique(input.latentFactors.map(f=>f.factorId)),
    sliderAssessmentId:input.sliderAssessment?.assessmentId,
    heavyTailRegimeBps:tail,
    evidenceIds,
    authority:'SIMULATION_ONLY',
    canExecute:false,
  })
}
