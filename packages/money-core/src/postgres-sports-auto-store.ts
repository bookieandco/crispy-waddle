import type {SqlClient} from './postgres-idempotency-store.js'
import {assertSportsHistoricalRecord,type SportsHistoricalRecord,type SportsHistoricalWarehouseStore} from './sports-historical-warehouse.js'
import type {SportsLearningEpisode,SportsLearningMemoryStore} from './sports-learning-memory.js'
import type {SportsBetShadowDecision} from './sports-bet-shadow-runtime.js'
import type {SportsForwardShadowRecord} from './sports-prediction-forward-shadow.js'

type HistoricalRow={
  record_id:string
  payload_json:unknown
}

type EpisodeRow={
  episode_id:string
  payload_json:unknown
}

type ShadowDecisionRow={
  decision_id:string
  payload_json:unknown
}

type ShadowRecordRow={
  record_id:string
  payload_json:unknown
}

const safeTable=(table:string):string=>{
  if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table))throw new Error('SPORT_AUTO_TABLE_INVALID')
  return table
}

function historicalFrom(row:HistoricalRow):SportsHistoricalRecord{
  const record=row.payload_json as SportsHistoricalRecord
  assertSportsHistoricalRecord(record)
  return Object.freeze({...record,evidenceIds:Object.freeze([...record.evidenceIds])})
}

function episodeFrom(row:EpisodeRow):SportsLearningEpisode{
  const episode=row.payload_json as SportsLearningEpisode
  if(!episode||episode.episodeId!==row.episode_id||episode.authority!=='SPORTS_LEARNING_MEMORY'||episode.canExecute!==false||episode.canAuthorizeLive!==false)throw new Error('SPORT_AUTO_MEMORY_ROW_CORRUPT')
  return Object.freeze({...episode,evidenceIds:Object.freeze([...episode.evidenceIds])})
}

export class PostgresSportsHistoricalWarehouseStore implements SportsHistoricalWarehouseStore{
  private readonly table:string
  constructor(private readonly client:SqlClient,table='sports_historical_records'){this.table=safeTable(table)}

  async append(record:SportsHistoricalRecord):Promise<void>{
    assertSportsHistoricalRecord(record)
    const result=await this.client.query<HistoricalRow>(
      `INSERT INTO ${this.table}(record_id,sport,competition_id,season_id,event_id,subject_id,kind,metric,observed_at,available_at,source_type,evidence_ids,payload_json)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::text[],$13::jsonb)
       ON CONFLICT(record_id) DO NOTHING
       RETURNING record_id,payload_json`,
      [record.recordId,record.sport,record.competitionId,record.seasonId,record.eventId??null,record.subjectId,record.kind,record.metric,record.observedAt,record.availableAt,record.sourceType,[...record.evidenceIds],JSON.stringify(record)],
    )
    if(result.rows[0])return
    const existing=await this.client.query<HistoricalRow>(`SELECT record_id,payload_json FROM ${this.table} WHERE record_id=$1 LIMIT 1`,[record.recordId])
    const row=existing.rows[0]
    if(!row||JSON.stringify(historicalFrom(row))!==JSON.stringify(record))throw new Error('SPORT_AUTO_HISTORY_DURABLE_CONFLICT')
  }

  async list():Promise<readonly SportsHistoricalRecord[]>{
    const result=await this.client.query<HistoricalRow>(`SELECT record_id,payload_json FROM ${this.table} ORDER BY available_at ASC,record_id ASC`)
    return Object.freeze(result.rows.map(historicalFrom))
  }
}

export class PostgresSportsLearningMemoryStore implements SportsLearningMemoryStore{
  private readonly table:string
  constructor(private readonly client:SqlClient,table='sports_learning_episodes'){this.table=safeTable(table)}

  async get(episodeId:string):Promise<SportsLearningEpisode|undefined>{
    const result=await this.client.query<EpisodeRow>(`SELECT episode_id,payload_json FROM ${this.table} WHERE episode_id=$1 LIMIT 1`,[episodeId])
    return result.rows[0]?episodeFrom(result.rows[0]):undefined
  }

  async put(episode:SportsLearningEpisode):Promise<void>{
    if(episode.authority!=='SPORTS_LEARNING_MEMORY'||episode.canAuthorizeLive!==false||episode.canExecute!==false)throw new Error('SPORT_AUTO_MEMORY_AUTHORITY_INVALID')
    await this.client.query(
      `INSERT INTO ${this.table}(episode_id,event_id,strategy_id,model_id,model_version,resolved_at,evidence_ids,payload_json)
       VALUES($1,$2,$3,$4,$5,$6,$7::text[],$8::jsonb)
       ON CONFLICT(episode_id) DO UPDATE SET payload_json=EXCLUDED.payload_json,evidence_ids=EXCLUDED.evidence_ids`,
      [episode.episodeId,episode.eventId,episode.strategyId,episode.modelId,episode.modelVersion,episode.resolvedAt,[...episode.evidenceIds],JSON.stringify(episode)],
    )
  }

  async list():Promise<readonly SportsLearningEpisode[]>{
    const result=await this.client.query<EpisodeRow>(`SELECT episode_id,payload_json FROM ${this.table} ORDER BY resolved_at ASC,episode_id ASC`)
    return Object.freeze(result.rows.map(episodeFrom))
  }
}

export class PostgresSportsShadowLedgerStore{
  private readonly decisionTable:string
  private readonly recordTable:string
  constructor(private readonly client:SqlClient,decisionTable='sports_shadow_decisions',recordTable='sports_shadow_records'){
    this.decisionTable=safeTable(decisionTable)
    this.recordTable=safeTable(recordTable)
  }

  async putDecision(decision:SportsBetShadowDecision):Promise<void>{
    if(decision.authority!=='SHADOW_ONLY'||decision.canExecute!==false)throw new Error('SPORT_AUTO_SHADOW_LEDGER_DECISION_AUTHORITY_INVALID')
    await this.client.query(
      `INSERT INTO ${this.decisionTable}(decision_id,prediction_id,event_id,decision_at,source_class,action,evidence_ids,payload_json)
       VALUES($1,$2,$3,$4,$5,$6,$7::text[],$8::jsonb)
       ON CONFLICT(decision_id) DO NOTHING`,
      [decision.decisionId,decision.predictionId,decision.eventId,decision.decisionAt,decision.sourceClass,decision.action,[...decision.evidenceIds],JSON.stringify(decision)],
    )
  }

  async putRecord(record:SportsForwardShadowRecord):Promise<void>{
    if(record.authority!=='LEARNING_ONLY'||record.canAuthorizeLive!==false)throw new Error('SPORT_AUTO_SHADOW_LEDGER_RECORD_AUTHORITY_INVALID')
    await this.client.query(
      `INSERT INTO ${this.recordTable}(record_id,prediction_id,event_id,resolved_at,evidence_ids,payload_json)
       VALUES($1,$2,$3,$4,$5::text[],$6::jsonb)
       ON CONFLICT(record_id) DO NOTHING`,
      [record.recordId,record.prediction.predictionId,record.prediction.eventId,record.resolvedAt,[...record.evidenceIds],JSON.stringify(record)],
    )
  }

  async listDecisions():Promise<readonly SportsBetShadowDecision[]>{
    const result=await this.client.query<ShadowDecisionRow>(`SELECT decision_id,payload_json FROM ${this.decisionTable} ORDER BY decision_at ASC,decision_id ASC`)
    return Object.freeze(result.rows.map(row=>row.payload_json as SportsBetShadowDecision))
  }

  async listRecords():Promise<readonly SportsForwardShadowRecord[]>{
    const result=await this.client.query<ShadowRecordRow>(`SELECT record_id,payload_json FROM ${this.recordTable} ORDER BY resolved_at ASC,record_id ASC`)
    return Object.freeze(result.rows.map(row=>row.payload_json as SportsForwardShadowRecord))
  }
}
