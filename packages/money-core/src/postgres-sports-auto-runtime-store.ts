import type {SqlClient} from './postgres-idempotency-store.js'
import type {
  SportsAutoPaperResolution,
  SportsAutoRuntimeCandidate,
  SportsAutoRuntimeStore,
  SportsAutoShadowResolution,
} from './sports-auto-runtime.js'
import type {SportsAutoPaperDecision} from './sports-auto-paper-league.js'
import type {SportsBetShadowDecision} from './sports-bet-shadow-runtime.js'
import {reviewSportsPredictionProcess} from './sports-prediction-process-review.js'
import type {SportsForwardShadowRecord} from './sports-prediction-forward-shadow.js'

type CandidateRow={prediction_id:string;state:'OPEN'|'RESOLVED';resolved_at:string|null;payload_json:unknown}
type PaperDecisionRow={prediction_id:string;payload_json:unknown}
type PaperResolutionRow={prediction_id:string;settlement_json:unknown;review_json:unknown}
type ShadowDecisionRow={prediction_id:string;payload_json:unknown}
type ShadowRecordRow={prediction_id:string;payload_json:unknown}

const safeTable=(value:string):string=>{
  if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))throw new Error('SPORT_AUTO_RUNTIME_TABLE_INVALID')
  return value
}

function encode(value:unknown):string{
  return JSON.stringify(value,(_,item)=>typeof item==='bigint'?{__sportAutoBigInt:item.toString()}:item)
}

function revive(value:unknown):unknown{
  if(Array.isArray(value))return value.map(revive)
  if(value&&typeof value==='object'){
    const record=value as Record<string,unknown>
    if(Object.keys(record).length===1&&typeof record.__sportAutoBigInt==='string'){
      return BigInt(record.__sportAutoBigInt)
    }
    const next:Record<string,unknown>={}
    for(const [key,item] of Object.entries(record))next[key]=revive(item)
    return next
  }
  return value
}

function asCandidate(row:CandidateRow):SportsAutoRuntimeCandidate{
  const candidate=revive(row.payload_json) as SportsAutoRuntimeCandidate
  if(!candidate||candidate.prediction.predictionId!==row.prediction_id||candidate.authority!=='INTELLIGENCE_ONLY'||candidate.canExecute!==false)throw new Error('SPORT_AUTO_RUNTIME_CANDIDATE_ROW_CORRUPT')
  return candidate
}

function asPaperDecision(row:PaperDecisionRow):SportsAutoPaperDecision{
  const decision=revive(row.payload_json) as SportsAutoPaperDecision
  if(!decision||decision.predictionId!==row.prediction_id||decision.authority!=='PAPER_AUTOMATION_ONLY'||decision.canExecute!==false)throw new Error('SPORT_AUTO_RUNTIME_PAPER_DECISION_ROW_CORRUPT')
  return decision
}

function asPaperResolution(row:PaperResolutionRow):SportsAutoPaperResolution{
  const settlement=revive(row.settlement_json) as SportsAutoPaperResolution['settlement']
  const review=revive(row.review_json) as SportsAutoPaperResolution['review']
  if(!settlement||!review||settlement.authority!=='LEARNING_ONLY'||review.authority!=='LEARNING_ONLY')throw new Error('SPORT_AUTO_RUNTIME_PAPER_RESOLUTION_ROW_CORRUPT')
  return Object.freeze({
    predictionId:row.prediction_id,
    settlement,
    review,
    authority:'LEARNING_ONLY',
    canAuthorizeLive:false,
    canExecute:false,
  })
}

function asShadowDecision(row:ShadowDecisionRow):SportsBetShadowDecision{
  const decision=revive(row.payload_json) as SportsBetShadowDecision
  if(!decision||decision.predictionId!==row.prediction_id||decision.authority!=='SHADOW_ONLY'||decision.canExecute!==false)throw new Error('SPORT_AUTO_RUNTIME_SHADOW_DECISION_ROW_CORRUPT')
  return decision
}

function asShadowResolution(row:ShadowRecordRow):SportsAutoShadowResolution{
  const record=revive(row.payload_json) as SportsForwardShadowRecord
  if(!record||record.prediction.predictionId!==row.prediction_id||record.authority!=='LEARNING_ONLY'||record.canAuthorizeLive!==false)throw new Error('SPORT_AUTO_RUNTIME_SHADOW_RECORD_ROW_CORRUPT')
  const review=reviewSportsPredictionProcess({record})
  return Object.freeze({
    predictionId:row.prediction_id,
    record,
    review,
    authority:'LEARNING_ONLY',
    canAuthorizeLive:false,
    canExecute:false,
  })
}

export class PostgresSportsAutoRuntimeStore implements SportsAutoRuntimeStore{
  private readonly candidates:string
  private readonly paperDecisions:string
  private readonly paperResolutions:string
  private readonly shadowDecisions:string
  private readonly shadowRecords:string

  constructor(private readonly client:SqlClient,tables?:Partial<Readonly<{
    candidates:string
    paperDecisions:string
    paperResolutions:string
    shadowDecisions:string
    shadowRecords:string
  }>>){
    this.candidates=safeTable(tables?.candidates??'sports_auto_candidates')
    this.paperDecisions=safeTable(tables?.paperDecisions??'sports_paper_decisions')
    this.paperResolutions=safeTable(tables?.paperResolutions??'sports_paper_resolutions')
    this.shadowDecisions=safeTable(tables?.shadowDecisions??'sports_shadow_decisions')
    this.shadowRecords=safeTable(tables?.shadowRecords??'sports_shadow_records')
  }

  async getCandidate(predictionId:string):Promise<SportsAutoRuntimeCandidate|undefined>{
    const result=await this.client.query<CandidateRow>(
      'SELECT prediction_id,state,resolved_at,payload_json FROM '+this.candidates+' WHERE prediction_id=$1 LIMIT 1',[predictionId],
    )
    return result.rows[0]?asCandidate(result.rows[0]):undefined
  }

  async putCandidate(candidate:SportsAutoRuntimeCandidate):Promise<void>{
    const predictionId=candidate.prediction.predictionId
    await this.client.query(
      'INSERT INTO '+this.candidates+'(prediction_id,candidate_id,opportunity_id,event_id,phase,discovered_at,state,evidence_ids,payload_json) VALUES($1,$2,$3,$4,$5,$6,\'OPEN\',$7::text[],$8::jsonb) ON CONFLICT(prediction_id) DO NOTHING',
      [predictionId,candidate.candidateId,candidate.opportunityId,candidate.prediction.eventId,candidate.phase,candidate.discoveredAt,[...candidate.evidenceIds],encode(candidate)],
    )
    const stored=await this.getCandidate(predictionId)
    if(!stored||stored.candidateId!==candidate.candidateId)throw new Error('SPORT_AUTO_RUNTIME_CANDIDATE_CONFLICT')
  }

  async listOpenCandidates():Promise<readonly SportsAutoRuntimeCandidate[]>{
    const result=await this.client.query<CandidateRow>(
      'SELECT prediction_id,state,resolved_at,payload_json FROM '+this.candidates+' WHERE state=\'OPEN\' ORDER BY discovered_at ASC,prediction_id ASC',
    )
    return Object.freeze(result.rows.map(asCandidate))
  }

  async markCandidateResolved(predictionId:string,resolvedAt:string):Promise<void>{
    await this.client.query(
      'UPDATE '+this.candidates+' SET state=\'RESOLVED\',resolved_at=COALESCE(resolved_at,$2) WHERE prediction_id=$1',
      [predictionId,resolvedAt],
    )
    const result=await this.client.query<CandidateRow>(
      'SELECT prediction_id,state,resolved_at,payload_json FROM '+this.candidates+' WHERE prediction_id=$1 LIMIT 1',[predictionId],
    )
    const row=result.rows[0]
    if(!row||row.state!=='RESOLVED'||row.resolved_at===null)throw new Error('SPORT_AUTO_RUNTIME_RESOLUTION_STATE_FAILED')
  }

  async getPaperDecision(predictionId:string):Promise<SportsAutoPaperDecision|undefined>{
    const result=await this.client.query<PaperDecisionRow>(
      'SELECT prediction_id,payload_json FROM '+this.paperDecisions+' WHERE prediction_id=$1 LIMIT 1',[predictionId],
    )
    return result.rows[0]?asPaperDecision(result.rows[0]):undefined
  }

  async putPaperDecision(decision:SportsAutoPaperDecision):Promise<void>{
    await this.client.query(
      'INSERT INTO '+this.paperDecisions+'(decision_id,prediction_id,event_id,action,decided_at,evidence_ids,payload_json) VALUES($1,$2,$3,$4,$5,$6::text[],$7::jsonb) ON CONFLICT(prediction_id) DO NOTHING',
      [decision.decisionId,decision.predictionId,decision.eventId,decision.action,decision.decidedAt,[...decision.evidenceIds],encode(decision)],
    )
    const stored=await this.getPaperDecision(decision.predictionId)
    if(!stored||stored.decisionId!==decision.decisionId)throw new Error('SPORT_AUTO_RUNTIME_PAPER_DECISION_CONFLICT')
  }

  async getPaperResolution(predictionId:string):Promise<SportsAutoPaperResolution|undefined>{
    const result=await this.client.query<PaperResolutionRow>(
      'SELECT prediction_id,settlement_json,review_json FROM '+this.paperResolutions+' WHERE prediction_id=$1 LIMIT 1',[predictionId],
    )
    return result.rows[0]?asPaperResolution(result.rows[0]):undefined
  }

  async putPaperResolution(resolution:SportsAutoPaperResolution):Promise<void>{
    await this.client.query(
      'INSERT INTO '+this.paperResolutions+'(settlement_id,prediction_id,wager_id,resolved_at,evidence_ids,settlement_json,review_json) VALUES($1,$2,$3,$4,$5::text[],$6::jsonb,$7::jsonb) ON CONFLICT(prediction_id) DO NOTHING',
      [resolution.settlement.settlementId,resolution.predictionId,resolution.settlement.wagerId,resolution.settlement.resolvedAt,[...resolution.settlement.evidenceIds],encode(resolution.settlement),encode(resolution.review)],
    )
    const stored=await this.getPaperResolution(resolution.predictionId)
    if(!stored||stored.settlement.settlementId!==resolution.settlement.settlementId)throw new Error('SPORT_AUTO_RUNTIME_PAPER_RESOLUTION_CONFLICT')
  }

  async getShadowDecision(predictionId:string):Promise<SportsBetShadowDecision|undefined>{
    const result=await this.client.query<ShadowDecisionRow>(
      'SELECT prediction_id,payload_json FROM '+this.shadowDecisions+' WHERE prediction_id=$1 LIMIT 1',[predictionId],
    )
    return result.rows[0]?asShadowDecision(result.rows[0]):undefined
  }

  async putShadowDecision(decision:SportsBetShadowDecision):Promise<void>{
    await this.client.query(
      'INSERT INTO '+this.shadowDecisions+'(decision_id,prediction_id,event_id,decision_at,source_class,action,evidence_ids,payload_json) VALUES($1,$2,$3,$4,$5,$6,$7::text[],$8::jsonb) ON CONFLICT(prediction_id) DO NOTHING',
      [decision.decisionId,decision.predictionId,decision.eventId,decision.decisionAt,decision.sourceClass,decision.action,[...decision.evidenceIds],encode(decision)],
    )
    const stored=await this.getShadowDecision(decision.predictionId)
    if(!stored||stored.decisionId!==decision.decisionId)throw new Error('SPORT_AUTO_RUNTIME_SHADOW_DECISION_CONFLICT')
  }

  async getShadowResolution(predictionId:string):Promise<SportsAutoShadowResolution|undefined>{
    const result=await this.client.query<ShadowRecordRow>(
      'SELECT prediction_id,payload_json FROM '+this.shadowRecords+' WHERE prediction_id=$1 LIMIT 1',[predictionId],
    )
    return result.rows[0]?asShadowResolution(result.rows[0]):undefined
  }

  async putShadowResolution(resolution:SportsAutoShadowResolution):Promise<void>{
    await this.client.query(
      'INSERT INTO '+this.shadowRecords+'(record_id,prediction_id,event_id,resolved_at,evidence_ids,payload_json) VALUES($1,$2,$3,$4,$5::text[],$6::jsonb) ON CONFLICT(prediction_id) DO NOTHING',
      [resolution.record.recordId,resolution.predictionId,resolution.record.prediction.eventId,resolution.record.resolvedAt,[...resolution.record.evidenceIds],encode(resolution.record)],
    )
    const stored=await this.getShadowResolution(resolution.predictionId)
    if(!stored||stored.record.recordId!==resolution.record.recordId)throw new Error('SPORT_AUTO_RUNTIME_SHADOW_RESOLUTION_CONFLICT')
  }
}
