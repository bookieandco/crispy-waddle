import {createHash} from 'node:crypto'

export type SportsHistoricalRecordKind=
  |'GAME'
  |'TEAM_GAME'
  |'TEAM_SEASON'
  |'PLAYER_GAME'
  |'PLAYER_SEASON'
  |'LINEUP'
  |'INJURY'
  |'VENUE'
  |'PLAY'
  |'MARKET'
  |'OTHER'

export type SportsHistoricalRecord=Readonly<{
  recordId:string
  sport:string
  competitionId:string
  seasonId:string
  eventId?:string
  subjectId:string
  kind:SportsHistoricalRecordKind
  metric:string
  value:string|number|boolean
  unit?:string
  observedAt:string
  availableAt:string
  sourceType:string
  sourceLocator?:string
  evidenceIds:readonly string[]
  authority:'HISTORICAL_EVIDENCE_ONLY'
  canExecute:false
}>

export type SportsHistoricalQuery=Readonly<{
  sport:string
  competitionId?:string
  seasonIds?:readonly string[]
  eventId?:string
  subjectIds?:readonly string[]
  kinds?:readonly SportsHistoricalRecordKind[]
  metrics?:readonly string[]
  informationCutoff:string
}>

export type SportsHistoricalSnapshot=Readonly<{
  snapshotId:string
  query:SportsHistoricalQuery
  records:readonly SportsHistoricalRecord[]
  excludedFutureRecordIds:readonly string[]
  subjectIds:readonly string[]
  seasons:readonly string[]
  metrics:readonly string[]
  informationCutoff:string
  authority:'HISTORICAL_MODEL_INPUT_ONLY'
  canExecute:false
}>

export type SportsHistoricalMetricSummary=Readonly<{
  subjectId:string
  metric:string
  sampleSize:number
  mean:number
  minimum:number
  maximum:number
  latestValue:number
  latestAvailableAt:string
  recentMean:number
  evidenceIds:readonly string[]
  authority:'DERIVED_HISTORICAL_FEATURE_ONLY'
  canExecute:false
}>

export interface SportsHistoricalWarehouseStore{
  append(record:SportsHistoricalRecord):Promise<void>|void
  list():Promise<readonly SportsHistoricalRecord[]>|readonly SportsHistoricalRecord[]
}

const hash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const nonEmpty=(value:string,code:string):void=>{if(!value.trim())throw new Error(code)}
const instant=(value:string,code:string):number=>{nonEmpty(value,code);const parsed=Date.parse(value);if(Number.isNaN(parsed))throw new Error(code);return parsed}
const unique=(values:readonly string[]):readonly string[]=>
  Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))].sort())

export function assertSportsHistoricalRecord(record:SportsHistoricalRecord):void{
  nonEmpty(record.recordId,'SPORT_AUTO_HISTORY_RECORD_ID_REQUIRED')
  nonEmpty(record.sport,'SPORT_AUTO_HISTORY_SPORT_REQUIRED')
  nonEmpty(record.competitionId,'SPORT_AUTO_HISTORY_COMPETITION_REQUIRED')
  nonEmpty(record.seasonId,'SPORT_AUTO_HISTORY_SEASON_REQUIRED')
  nonEmpty(record.subjectId,'SPORT_AUTO_HISTORY_SUBJECT_REQUIRED')
  nonEmpty(record.metric,'SPORT_AUTO_HISTORY_METRIC_REQUIRED')
  nonEmpty(record.sourceType,'SPORT_AUTO_HISTORY_SOURCE_REQUIRED')
  const observedAt=instant(record.observedAt,'SPORT_AUTO_HISTORY_OBSERVED_AT_INVALID')
  const availableAt=instant(record.availableAt,'SPORT_AUTO_HISTORY_AVAILABLE_AT_INVALID')
  if(availableAt<observedAt)throw new Error('SPORT_AUTO_HISTORY_AVAILABLE_BEFORE_OBSERVED')
  if(!record.evidenceIds.length)throw new Error('SPORT_AUTO_HISTORY_EVIDENCE_REQUIRED')
  if(record.authority!=='HISTORICAL_EVIDENCE_ONLY'||record.canExecute!==false)throw new Error('SPORT_AUTO_HISTORY_AUTHORITY_INVALID')
  if(typeof record.value==='number'&&!Number.isFinite(record.value))throw new Error('SPORT_AUTO_HISTORY_NUMERIC_VALUE_INVALID')
}

export class InMemorySportsHistoricalWarehouseStore implements SportsHistoricalWarehouseStore{
  private readonly records=new Map<string,SportsHistoricalRecord>()

  append(record:SportsHistoricalRecord):void{
    assertSportsHistoricalRecord(record)
    const existing=this.records.get(record.recordId)
    if(existing&&JSON.stringify(existing)!==JSON.stringify(record))throw new Error('SPORT_AUTO_HISTORY_RECORD_ID_CONFLICT')
    this.records.set(record.recordId,Object.freeze({...record,evidenceIds:unique(record.evidenceIds)}))
  }

  list():readonly SportsHistoricalRecord[]{
    return Object.freeze([...this.records.values()].sort((a,b)=>a.availableAt.localeCompare(b.availableAt)||a.recordId.localeCompare(b.recordId)))
  }
}

function includesOptional<T>(filter:readonly T[]|undefined,value:T):boolean{
  return filter===undefined||filter.includes(value)
}

export async function buildSportsHistoricalSnapshot(input:{
  store:SportsHistoricalWarehouseStore
  query:SportsHistoricalQuery
}):Promise<SportsHistoricalSnapshot>{
  nonEmpty(input.query.sport,'SPORT_AUTO_HISTORY_QUERY_SPORT_REQUIRED')
  instant(input.query.informationCutoff,'SPORT_AUTO_HISTORY_QUERY_CUTOFF_INVALID')
  const all=await input.store.list()
  for(const record of all)assertSportsHistoricalRecord(record)
  const scoped=all.filter(record=>
    record.sport===input.query.sport&&
    (input.query.competitionId===undefined||record.competitionId===input.query.competitionId)&&
    includesOptional(input.query.seasonIds,record.seasonId)&&
    (input.query.eventId===undefined||record.eventId===input.query.eventId)&&
    includesOptional(input.query.subjectIds,record.subjectId)&&
    includesOptional(input.query.kinds,record.kind)&&
    includesOptional(input.query.metrics,record.metric)
  )
  const records=scoped.filter(record=>record.availableAt<=input.query.informationCutoff)
  const excluded=scoped.filter(record=>record.availableAt>input.query.informationCutoff)
  const frozenRecords=Object.freeze(records.map(record=>Object.freeze({...record,evidenceIds:unique(record.evidenceIds)})))
  const normalizedQuery=Object.freeze({
    ...input.query,
    seasonIds:input.query.seasonIds?unique(input.query.seasonIds):undefined,
    subjectIds:input.query.subjectIds?unique(input.query.subjectIds):undefined,
    metrics:input.query.metrics?unique(input.query.metrics):undefined,
    kinds:input.query.kinds?Object.freeze([...new Set(input.query.kinds)].sort()):undefined,
  })
  return Object.freeze({
    snapshotId:'sports-history:'+hash({
      query:normalizedQuery,
      recordIds:frozenRecords.map(record=>record.recordId),
      excludedIds:excluded.map(record=>record.recordId).sort(),
    }),
    query:normalizedQuery,
    records:frozenRecords,
    excludedFutureRecordIds:unique(excluded.map(record=>record.recordId)),
    subjectIds:unique(frozenRecords.map(record=>record.subjectId)),
    seasons:unique(frozenRecords.map(record=>record.seasonId)),
    metrics:unique(frozenRecords.map(record=>record.metric)),
    informationCutoff:input.query.informationCutoff,
    authority:'HISTORICAL_MODEL_INPUT_ONLY',
    canExecute:false,
  })
}

export function summarizeSportsHistoricalMetrics(input:{
  snapshot:SportsHistoricalSnapshot
  recentSampleSize?:number
}):readonly SportsHistoricalMetricSummary[]{
  if(input.snapshot.authority!=='HISTORICAL_MODEL_INPUT_ONLY'||input.snapshot.canExecute!==false)throw new Error('SPORT_AUTO_HISTORY_SNAPSHOT_AUTHORITY_INVALID')
  const recentSampleSize=input.recentSampleSize??5
  if(!Number.isInteger(recentSampleSize)||recentSampleSize<1)throw new Error('SPORT_AUTO_HISTORY_RECENT_SAMPLE_SIZE_INVALID')
  const groups=new Map<string,SportsHistoricalRecord[]>()
  for(const record of input.snapshot.records){
    if(typeof record.value!=='number')continue
    const key=record.subjectId+'|'+record.metric
    const records=groups.get(key)??[]
    records.push(record)
    groups.set(key,records)
  }
  const summaries:SportsHistoricalMetricSummary[]=[]
  for(const records of groups.values()){
    const ordered=[...records].sort((a,b)=>a.availableAt.localeCompare(b.availableAt)||a.recordId.localeCompare(b.recordId))
    const latest=ordered[ordered.length-1]
    if(!latest||typeof latest.value!=='number')continue
    const values=ordered.map(record=>record.value).filter((value):value is number=>typeof value==='number')
    const recent=values.slice(-recentSampleSize)
    const mean=values.reduce((total,value)=>total+value,0)/values.length
    const recentMean=recent.reduce((total,value)=>total+value,0)/recent.length
    summaries.push(Object.freeze({
      subjectId:latest.subjectId,
      metric:latest.metric,
      sampleSize:values.length,
      mean,
      minimum:Math.min(...values),
      maximum:Math.max(...values),
      latestValue:latest.value,
      latestAvailableAt:latest.availableAt,
      recentMean,
      evidenceIds:unique(ordered.flatMap(record=>record.evidenceIds)),
      authority:'DERIVED_HISTORICAL_FEATURE_ONLY',
      canExecute:false,
    }))
  }
  return Object.freeze(summaries.sort((a,b)=>(a.subjectId+'|'+a.metric).localeCompare(b.subjectId+'|'+b.metric)))
}
