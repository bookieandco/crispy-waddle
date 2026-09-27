import { createHash } from 'node:crypto'

export const SPORTS_HISTORY_REFERENCES=Object.freeze({
  sportsdataverseJs:Object.freeze({
    repository:'https://github.com/sportsdataverse/sportsdataverse-js',
    auditedCommit:'f5069ee3d0c50aaf92f1c76d761c1c6063d0fe3c',
    license:'MIT',
    role:'PRIMARY_MULTI_SPORT_DATA_ECOSYSTEM_REFERENCE',
  }),
  sportsdataversePy:Object.freeze({
    repository:'https://github.com/sportsdataverse/sportsdataverse-py',
    auditedCommit:'9e20c292a670d805a11aec06ef8ef2bcd3968966',
    license:'MIT',
    role:'PYTHON_DATASET_AND_PARSER_REFERENCE',
  }),
  sportsipy:Object.freeze({
    repository:'https://github.com/roclark/sportsipy',
    auditedCommit:'fffb7c8170454720622089cf794ebcb106245e4d',
    license:'MIT',
    role:'HISTORICAL_ENTITY_AND_SEASON_SCHEMA_REFERENCE',
    activeDevelopment:false,
  }),
  sportsPress:Object.freeze({
    repository:'https://github.com/ThemeBoy/SportsPress',
    auditedCommit:'fa1d75729638314ed7583258c31cb3c67d213646',
    license:'GPL-3.0-or-later',
    role:'HISTORICAL_PRESENTATION_AND_LEAGUE_MANAGEMENT_REFERENCE_ONLY',
    codeImportAllowed:false,
  }),
} as const)

export type SportsHistoryEntityKind='PLAYER'|'TEAM'
export type SportsHistoryVenue='HOME'|'AWAY'|'NEUTRAL'|'UNKNOWN'
export type SportsHistoryCompetitionPhase='REGULAR'|'PLAYOFFS'|'TOURNAMENT'|'PRESEASON'|'OTHER'|'UNKNOWN'
export type SportsHistorySourceClass='PRIMARY_API'|'DATASET'|'DERIVED'|'REFERENCE_ONLY'

export type SportsHistoricalStatRecord=Readonly<{
  recordId:string
  entityKind:SportsHistoryEntityKind
  entityId:string
  entityLabel:string
  sport:string
  competition:string
  season:string
  eventId:string
  eventDate:string
  opponentId?:string
  opponentLabel?:string
  teamId?:string
  teamLabel?:string
  venue:SportsHistoryVenue
  phase:SportsHistoryCompetitionPhase
  statKey:string
  statLabel:string
  value:number
  numerator?:number
  denominator?:number
  unit?:string
  minutesOrOpportunities?:number
  observedAt:string
  availableAt:string
  sourceProvider:string
  sourceClass:SportsHistorySourceClass
  evidenceIds:readonly string[]
  authority:'HISTORICAL_EVIDENCE_ONLY'
  canExecute:false
}>

export type SportsHistoryScope=
  |Readonly<{kind:'ALL_TIME'}>
  |Readonly<{kind:'CAREER'}>
  |Readonly<{kind:'SEASON';season:string}>
  |Readonly<{kind:'LAST_N';count:number}>
  |Readonly<{kind:'VS_OPPONENT';opponentId?:string;opponentLabel?:string}>
  |Readonly<{kind:'VENUE';venue:'HOME'|'AWAY'|'NEUTRAL'}>
  |Readonly<{kind:'PLAYOFFS'}>
  |Readonly<{kind:'DATE_RANGE';from?:string;to?:string}>
  |Readonly<{kind:'AS_OF';at:string}>

export type SportsHistoryQuery=Readonly<{
  queryId:string
  entityKind:SportsHistoryEntityKind
  entityId:string
  sport?:string
  competition?:string
  statKeys?:readonly string[]
  scopes:readonly SportsHistoryScope[]
  asOf:string
  limit?:number
  cursor?:string
}>

export type SportsHistorySummary=Readonly<{
  statKey:string
  statLabel:string
  sampleSize:number
  firstEventDate:string
  lastEventDate:string
  sum:number
  mean:number
  stdDev:number
  min:number
  p10:number
  p25:number
  p50:number
  p75:number
  p90:number
  max:number
  hitRatesByThreshold:Readonly<Record<string,number>>
  seasons:readonly Readonly<{
    season:string
    sampleSize:number
    sum:number
    mean:number
  }>[]
}>

export type SportsHistoryView=Readonly<{
  viewId:string
  query:SportsHistoryQuery
  records:readonly SportsHistoricalStatRecord[]
  summaries:readonly SportsHistorySummary[]
  allTimeAvailable:boolean
  coverage:Readonly<{
    firstEventDate:string|null
    lastEventDate:string|null
    seasons:readonly string[]
    competitions:readonly string[]
    sourceProviders:readonly string[]
    totalRecords:number
  }>
  warnings:readonly string[]
  evidenceIds:readonly string[]
  authority:'HISTORICAL_EVIDENCE_ONLY'
  predictiveAuthority:'NONE'
  bettingAuthority:'NONE'
  financialAuthority:'NONE'
  canExecute:false
}>

export type SportsHistoryFeatureSlice=Readonly<{
  sliceId:string
  entityId:string
  statKey:string
  scopeLabel:string
  sampleSize:number
  rawMean:number
  recencyWeightedMean:number
  eraNormalizedMean?:number
  sourceViewId:string
  evidenceIds:readonly string[]
  authority:'FEATURE_CANDIDATE_ONLY'
  admittedToSimulation:false
  canExecute:false
}>

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const avg=(xs:readonly number[])=>xs.reduce((a,b)=>a+b,0)/xs.length

function assertIso(value:string,code:string):void{
  if(Number.isNaN(Date.parse(value)))throw new Error(code)
}

export function assertSportsHistoricalStatRecord(r:SportsHistoricalStatRecord):void{
  if(!r.recordId.trim()||!r.entityId.trim()||!r.entityLabel.trim()||!r.sport.trim()||!r.competition.trim()||!r.season.trim()||!r.eventId.trim()||!r.statKey.trim()||!r.statLabel.trim()||!r.sourceProvider.trim())throw new Error('SPORT_HISTORY_RECORD_IDENTITY_REQUIRED')
  if(!Number.isFinite(r.value))throw new Error('SPORT_HISTORY_RECORD_VALUE_INVALID')
  if(r.numerator!==undefined&&!Number.isFinite(r.numerator))throw new Error('SPORT_HISTORY_RECORD_NUMERATOR_INVALID')
  if(r.denominator!==undefined&&(!Number.isFinite(r.denominator)||r.denominator<0))throw new Error('SPORT_HISTORY_RECORD_DENOMINATOR_INVALID')
  if(r.minutesOrOpportunities!==undefined&&(!Number.isFinite(r.minutesOrOpportunities)||r.minutesOrOpportunities<0))throw new Error('SPORT_HISTORY_RECORD_OPPORTUNITY_INVALID')
  assertIso(r.eventDate,'SPORT_HISTORY_RECORD_EVENT_DATE_INVALID')
  assertIso(r.observedAt,'SPORT_HISTORY_RECORD_OBSERVED_AT_INVALID')
  assertIso(r.availableAt,'SPORT_HISTORY_RECORD_AVAILABLE_AT_INVALID')
  if(Date.parse(r.availableAt)<Date.parse(r.observedAt))throw new Error('SPORT_HISTORY_RECORD_AVAILABILITY_INVALID')
  if(!r.evidenceIds.length)throw new Error('SPORT_HISTORY_RECORD_EVIDENCE_REQUIRED')
  if(r.authority!=='HISTORICAL_EVIDENCE_ONLY'||r.canExecute!==false)throw new Error('SPORT_HISTORY_RECORD_AUTHORITY_INVALID')
}

export function assertSportsHistoryQuery(q:SportsHistoryQuery):void{
  if(!q.queryId.trim()||!q.entityId.trim()||!q.scopes.length)throw new Error('SPORT_HISTORY_QUERY_IDENTITY_REQUIRED')
  assertIso(q.asOf,'SPORT_HISTORY_QUERY_AS_OF_INVALID')
  if(q.limit!==undefined&&(!Number.isInteger(q.limit)||q.limit<1||q.limit>100000))throw new Error('SPORT_HISTORY_QUERY_LIMIT_INVALID')
  for(const scope of q.scopes){
    switch(scope.kind){
      case 'SEASON':if(!scope.season.trim())throw new Error('SPORT_HISTORY_QUERY_SEASON_REQUIRED');break
      case 'LAST_N':if(!Number.isInteger(scope.count)||scope.count<1||scope.count>100000)throw new Error('SPORT_HISTORY_QUERY_LAST_N_INVALID');break
      case 'VS_OPPONENT':if(!scope.opponentId?.trim()&&!scope.opponentLabel?.trim())throw new Error('SPORT_HISTORY_QUERY_OPPONENT_REQUIRED');break
      case 'DATE_RANGE':
        if(scope.from)assertIso(scope.from,'SPORT_HISTORY_QUERY_DATE_FROM_INVALID')
        if(scope.to)assertIso(scope.to,'SPORT_HISTORY_QUERY_DATE_TO_INVALID')
        if(scope.from&&scope.to&&Date.parse(scope.from)>Date.parse(scope.to))throw new Error('SPORT_HISTORY_QUERY_DATE_RANGE_INVALID')
        break
      case 'AS_OF':assertIso(scope.at,'SPORT_HISTORY_QUERY_SCOPE_AS_OF_INVALID');break
      default:break
    }
  }
}

function scopeFilter(records:readonly SportsHistoricalStatRecord[],scope:SportsHistoryScope):SportsHistoricalStatRecord[]{
  switch(scope.kind){
    case 'ALL_TIME':
    case 'CAREER':
      return [...records]
    case 'SEASON':
      return records.filter(r=>r.season===scope.season)
    case 'LAST_N': {
      const eventIds=[...new Map(
        [...records]
          .sort((a,b)=>Date.parse(b.eventDate)-Date.parse(a.eventDate)||b.eventId.localeCompare(a.eventId))
          .map(r=>[r.eventId,r] as const)
      ).keys()].slice(0,scope.count)
      const admitted=new Set(eventIds)
      return records.filter(r=>admitted.has(r.eventId))
    }
    case 'VS_OPPONENT': {
      const wanted=scope.opponentLabel?.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
      return records.filter(r=>{
        if(scope.opponentId&&r.opponentId!==scope.opponentId)return false
        if(!wanted)return true
        const actual=r.opponentLabel?.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()??''
        return actual===wanted||actual.includes(wanted)||wanted.includes(actual)
      })
    }
    case 'VENUE':
      return records.filter(r=>r.venue===scope.venue)
    case 'PLAYOFFS':
      return records.filter(r=>r.phase==='PLAYOFFS'||r.phase==='TOURNAMENT')
    case 'DATE_RANGE':
      return records.filter(r=>(!scope.from||Date.parse(r.eventDate)>=Date.parse(scope.from))&&(!scope.to||Date.parse(r.eventDate)<=Date.parse(scope.to)))
    case 'AS_OF':
      return records.filter(r=>Date.parse(r.availableAt)<=Date.parse(scope.at))
  }
}

function quantile(sorted:readonly number[],p:number):number{
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.floor((sorted.length-1)*p)))]!
}

function summarize(statKey:string,rows:readonly SportsHistoricalStatRecord[],thresholds:readonly number[]):SportsHistorySummary{
  if(!rows.length)throw new Error('SPORT_HISTORY_SUMMARY_EMPTY')
  const sortedValues=rows.map(r=>r.value).sort((a,b)=>a-b)
  const mean=avg(sortedValues)
  const variance=avg(sortedValues.map(v=>(v-mean)**2))
  const seasons=new Map<string,number[]>()
  for(const r of rows){
    const bucket=seasons.get(r.season)??[]
    bucket.push(r.value)
    seasons.set(r.season,bucket)
  }
  const hitRates:Record<string,number>={}
  for(const t of thresholds)hitRates[String(t)]=rows.filter(r=>r.value>t).length/rows.length
  return Object.freeze({
    statKey,
    statLabel:rows[0]!.statLabel,
    sampleSize:rows.length,
    firstEventDate:[...rows].sort((a,b)=>Date.parse(a.eventDate)-Date.parse(b.eventDate))[0]!.eventDate,
    lastEventDate:[...rows].sort((a,b)=>Date.parse(b.eventDate)-Date.parse(a.eventDate))[0]!.eventDate,
    sum:sortedValues.reduce((a,b)=>a+b,0),
    mean,
    stdDev:Math.sqrt(variance),
    min:sortedValues[0]!,
    p10:quantile(sortedValues,.10),
    p25:quantile(sortedValues,.25),
    p50:quantile(sortedValues,.50),
    p75:quantile(sortedValues,.75),
    p90:quantile(sortedValues,.90),
    max:sortedValues[sortedValues.length-1]!,
    hitRatesByThreshold:Object.freeze(hitRates),
    seasons:Object.freeze([...seasons.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([season,values])=>Object.freeze({
      season,
      sampleSize:values.length,
      sum:values.reduce((a,b)=>a+b,0),
      mean:avg(values),
    }))),
  })
}

export function buildSportsHistoryView(input:{
  query:SportsHistoryQuery
  records:readonly SportsHistoricalStatRecord[]
  thresholdsByStat?:Readonly<Record<string,readonly number[]>>
  providerClaimsAllTimeCoverage?:boolean
  warnings?:readonly string[]
}):SportsHistoryView{
  assertSportsHistoryQuery(input.query)
  for(const r of input.records)assertSportsHistoricalStatRecord(r)

  const deduped=new Map<string,SportsHistoricalStatRecord>()
  for(const r of input.records){
    if(r.entityKind!==input.query.entityKind||r.entityId!==input.query.entityId)continue
    if(input.query.sport&&r.sport!==input.query.sport)continue
    if(input.query.competition&&r.competition!==input.query.competition)continue
    if(input.query.statKeys?.length&&!input.query.statKeys.some(key=>r.statKey===key||r.statKey.endsWith('.'+key)))continue
    if(Date.parse(r.availableAt)>Date.parse(input.query.asOf))continue
    const existing=deduped.get(r.recordId)
    if(!existing||Date.parse(r.availableAt)>Date.parse(existing.availableAt))deduped.set(r.recordId,r)
  }

  let scoped=[...deduped.values()]
  const terminalWindows=input.query.scopes.filter(scope=>scope.kind==='LAST_N')
  for(const scope of input.query.scopes){
    if(scope.kind==='LAST_N')continue
    scoped=scopeFilter(scoped,scope)
  }
  for(const scope of terminalWindows)scoped=scopeFilter(scoped,scope)
  scoped.sort((a,b)=>Date.parse(a.eventDate)-Date.parse(b.eventDate)||a.recordId.localeCompare(b.recordId))
  if(input.query.limit!==undefined)scoped=scoped.slice(-input.query.limit)

  const byStat=new Map<string,SportsHistoricalStatRecord[]>()
  for(const r of scoped){
    const rows=byStat.get(r.statKey)??[]
    rows.push(r)
    byStat.set(r.statKey,rows)
  }
  const summaries=[...byStat.entries()].map(([statKey,rows])=>summarize(statKey,rows,input.thresholdsByStat?.[statKey]??[]))
  const first=scoped[0]?.eventDate??null
  const last=scoped[scoped.length-1]?.eventDate??null
  const allTimeRequested=input.query.scopes.some(s=>s.kind==='ALL_TIME'||s.kind==='CAREER')
  const allTimeAvailable=Boolean(allTimeRequested&&input.providerClaimsAllTimeCoverage&&scoped.length)
  const warnings=unique([
    ...(input.warnings??[]),
    ...(allTimeRequested&&!allTimeAvailable?['Provider did not certify complete all-time/career coverage for this query.']:[]),
    'Historical evidence is queryable context only until a separate feature-selection/calibration step admits a slice into SPORT-SIM.',
  ])

  return Object.freeze({
    viewId:'sport-history:'+hash({query:input.query,records:scoped.map(r=>r.recordId)}),
    query:input.query,
    records:Object.freeze(scoped),
    summaries:Object.freeze(summaries),
    allTimeAvailable,
    coverage:Object.freeze({
      firstEventDate:first,
      lastEventDate:last,
      seasons:unique(scoped.map(r=>r.season)),
      competitions:unique(scoped.map(r=>r.competition)),
      sourceProviders:unique(scoped.map(r=>r.sourceProvider)),
      totalRecords:scoped.length,
    }),
    warnings,
    evidenceIds:unique(scoped.flatMap(r=>r.evidenceIds)),
    authority:'HISTORICAL_EVIDENCE_ONLY',
    predictiveAuthority:'NONE',
    bettingAuthority:'NONE',
    financialAuthority:'NONE',
    canExecute:false,
  })
}

export function createSportsHistoryFeatureSlice(input:{
  view:SportsHistoryView
  statKey:string
  halfLifeDays:number
  eraBaselineMean?:number
  eraBaselineStdDev?:number
  scopeLabel:string
}):SportsHistoryFeatureSlice{
  if(!input.statKey.trim()||!input.scopeLabel.trim())throw new Error('SPORT_HISTORY_FEATURE_IDENTITY_REQUIRED')
  if(!Number.isFinite(input.halfLifeDays)||input.halfLifeDays<=0)throw new Error('SPORT_HISTORY_FEATURE_HALF_LIFE_INVALID')
  const rows=input.view.records.filter(r=>r.statKey===input.statKey)
  if(!rows.length)throw new Error('SPORT_HISTORY_FEATURE_NO_ROWS')
  const cutoff=Date.parse(input.view.query.asOf)
  let weightedSum=0,weightTotal=0
  for(const r of rows){
    const ageDays=Math.max(0,(cutoff-Date.parse(r.eventDate))/86400000)
    const weight=Math.pow(.5,ageDays/input.halfLifeDays)
    weightedSum+=r.value*weight
    weightTotal+=weight
  }
  const rawMean=avg(rows.map(r=>r.value))
  const recencyWeightedMean=weightedSum/weightTotal
  let eraNormalizedMean:number|undefined
  if(input.eraBaselineMean!==undefined||input.eraBaselineStdDev!==undefined){
    if(input.eraBaselineMean===undefined||input.eraBaselineStdDev===undefined||!Number.isFinite(input.eraBaselineMean)||!Number.isFinite(input.eraBaselineStdDev)||input.eraBaselineStdDev<=0)throw new Error('SPORT_HISTORY_FEATURE_ERA_BASELINE_INVALID')
    eraNormalizedMean=(rawMean-input.eraBaselineMean)/input.eraBaselineStdDev
  }
  return Object.freeze({
    sliceId:'sport-history-slice:'+hash({view:input.view.viewId,statKey:input.statKey,scopeLabel:input.scopeLabel,halfLifeDays:input.halfLifeDays}),
    entityId:input.view.query.entityId,
    statKey:input.statKey,
    scopeLabel:input.scopeLabel,
    sampleSize:rows.length,
    rawMean,
    recencyWeightedMean,
    eraNormalizedMean,
    sourceViewId:input.view.viewId,
    evidenceIds:input.view.evidenceIds,
    authority:'FEATURE_CANDIDATE_ONLY',
    admittedToSimulation:false,
    canExecute:false,
  })
}
