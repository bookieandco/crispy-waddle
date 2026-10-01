import type { SqlClient } from './postgres-idempotency-store.js'
import {
 type PurseFinancialTemperament,
 type PurseLearningEpisode,
 type PurseStrategyLearningProfile,
} from './purse-learning-memory.js'

export interface PurseLearningStore{
 appendEpisode(userId:string,cofferId:string,episode:PurseLearningEpisode):Promise<'INSERTED'|'REPLAY'>|('INSERTED'|'REPLAY')
 listEpisodes(userId:string,lane:string,strategyId:string,limit?:number):Promise<readonly PurseLearningEpisode[]>|readonly PurseLearningEpisode[]
 appendProfile(userId:string,cofferId:string,profile:PurseStrategyLearningProfile):Promise<'INSERTED'|'REPLAY'>|('INSERTED'|'REPLAY')
 latestProfile(userId:string,lane:string,strategyId:string):Promise<PurseStrategyLearningProfile|undefined>|PurseStrategyLearningProfile|undefined
 appendTemperament(userId:string,cofferId:string,temperament:PurseFinancialTemperament):Promise<'INSERTED'|'REPLAY'>|('INSERTED'|'REPLAY')
 latestTemperament(userId:string):Promise<PurseFinancialTemperament|undefined>|PurseFinancialTemperament|undefined
}

const stable=(value:unknown)=>JSON.stringify(value,(_,item)=>typeof item==='bigint'?item.toString():item)
const assertAuthority=(value:{authority:string;financialAuthority:string;canAuthorizeLive:boolean;canExecute:boolean},code:string)=>{
 if(value.financialAuthority!=='NONE'||value.canAuthorizeLive!==false||value.canExecute!==false)throw new Error(code)
}

export class InMemoryPurseLearningStore implements PurseLearningStore{
 private readonly episodes=new Map<string,{userId:string;cofferId:string;value:PurseLearningEpisode}>()
 private readonly profiles=new Map<string,{userId:string;cofferId:string;value:PurseStrategyLearningProfile}>()
 private readonly temperaments=new Map<string,{userId:string;cofferId:string;value:PurseFinancialTemperament}>()

 appendEpisode(userId:string,cofferId:string,episode:PurseLearningEpisode):'INSERTED'|'REPLAY'{
  assertAuthority(episode,'PURSE_LEARNING_STORE_EPISODE_AUTHORITY_INVALID')
  const prior=this.episodes.get(episode.episodeId)
  if(prior){
   if(prior.userId!==userId||prior.cofferId!==cofferId||stable(prior.value)!==stable(episode))throw new Error('PURSE_LEARNING_STORE_EPISODE_CONFLICT')
   return 'REPLAY'
  }
  this.episodes.set(episode.episodeId,{userId,cofferId,value:episode})
  return 'INSERTED'
 }
 listEpisodes(userId:string,lane:string,strategyId:string,limit=500):readonly PurseLearningEpisode[]{
  if(!Number.isInteger(limit)||limit<1||limit>5000)throw new Error('PURSE_LEARNING_STORE_LIMIT_INVALID')
  return Object.freeze([...this.episodes.values()].filter(x=>x.userId===userId&&x.value.lane===lane&&x.value.strategyId===strategyId)
   .sort((a,b)=>b.value.observedAt.localeCompare(a.value.observedAt)||b.value.episodeId.localeCompare(a.value.episodeId)).slice(0,limit).map(x=>x.value))
 }
 appendProfile(userId:string,cofferId:string,profile:PurseStrategyLearningProfile):'INSERTED'|'REPLAY'{
  assertAuthority(profile,'PURSE_LEARNING_STORE_PROFILE_AUTHORITY_INVALID')
  const prior=this.profiles.get(profile.profileId)
  if(prior){
   if(prior.userId!==userId||prior.cofferId!==cofferId||stable(prior.value)!==stable(profile))throw new Error('PURSE_LEARNING_STORE_PROFILE_CONFLICT')
   return 'REPLAY'
  }
  this.profiles.set(profile.profileId,{userId,cofferId,value:profile})
  return 'INSERTED'
 }
 latestProfile(userId:string,lane:string,strategyId:string):PurseStrategyLearningProfile|undefined{
  return [...this.profiles.values()].filter(x=>x.userId===userId&&x.value.lane===lane&&x.value.strategyId===strategyId)
   .sort((a,b)=>b.value.calibratedAt.localeCompare(a.value.calibratedAt)||b.value.profileId.localeCompare(a.value.profileId))[0]?.value
 }
 appendTemperament(userId:string,cofferId:string,temperament:PurseFinancialTemperament):'INSERTED'|'REPLAY'{
  assertAuthority(temperament,'PURSE_LEARNING_STORE_TEMPERAMENT_AUTHORITY_INVALID')
  const prior=this.temperaments.get(temperament.temperamentId)
  if(prior){
   if(prior.userId!==userId||prior.cofferId!==cofferId||stable(prior.value)!==stable(temperament))throw new Error('PURSE_LEARNING_STORE_TEMPERAMENT_CONFLICT')
   return 'REPLAY'
  }
  this.temperaments.set(temperament.temperamentId,{userId,cofferId,value:temperament})
  return 'INSERTED'
 }
 latestTemperament(userId:string):PurseFinancialTemperament|undefined{
  return [...this.temperaments.values()].filter(x=>x.userId===userId)
   .sort((a,b)=>b.value.derivedAt.localeCompare(a.value.derivedAt)||b.value.temperamentId.localeCompare(a.value.temperamentId))[0]?.value
 }
}

type EpisodeRow={
 episode_id:string;source:PurseLearningEpisode['source'];source_record_id:string;lane:PurseLearningEpisode['lane'];strategy_id:string;instrument_id:string|null;scenario_id:string|null;
 return_bps:number;decision_quality_bps:number;execution_quality_bps:number;downside_occurred:boolean;thesis_disposition:PurseLearningEpisode['thesisDisposition'];
 sizing_diagnosis:PurseLearningEpisode['sizingDiagnosis'];lesson_tags:string[];observed_at:string|Date;evidence_ids:string[];
}
type ProfileRow={
 profile_id:string;lane:PurseStrategyLearningProfile['lane'];strategy_id:string;sample_size:number;mean_return_bps:number;win_rate_bps:number;downside_rate_bps:number;
 mean_decision_quality_bps:number;mean_execution_quality_bps:number;supported_thesis_rate_bps:number;invalidated_thesis_rate_bps:number;evidence_strength_bps:number;
 confidence_adjustment_bps:number;sizing_multiplier_bps:number;disposition:PurseStrategyLearningProfile['disposition'];lesson_tags:string[];episode_ids:string[];evidence_ids:string[];calibrated_at:string|Date;
}
type TemperamentRow={
 temperament_id:string;personality_version:number;cash_patience_bps:number;evidence_discipline_bps:number;exploration_bps:number;loss_sensitivity_bps:number;
 independent_assessment_required:boolean;live_personality_risk_boost_allowed:boolean;paper_exploration_only:boolean;explanation_style:PurseFinancialTemperament['explanationStyle'];
 derived_at:string|Date;evidence_ids:string[];
}
const iso=(v:string|Date)=>v instanceof Date?v.toISOString():new Date(v).toISOString()
const safeTable=(v:string)=>{if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v))throw new Error('PURSE_LEARNING_STORE_TABLE_INVALID');return v}
const episodeFromRow=(r:EpisodeRow):PurseLearningEpisode=>Object.freeze({
 episodeId:r.episode_id,source:r.source,sourceRecordId:r.source_record_id,lane:r.lane,strategyId:r.strategy_id,instrumentId:r.instrument_id??undefined,scenarioId:r.scenario_id??undefined,
 returnBps:r.return_bps,decisionQualityBps:r.decision_quality_bps,executionQualityBps:r.execution_quality_bps,downsideOccurred:r.downside_occurred,thesisDisposition:r.thesis_disposition,
 sizingDiagnosis:r.sizing_diagnosis,lessonTags:Object.freeze(r.lesson_tags??[]),observedAt:iso(r.observed_at),evidenceIds:Object.freeze(r.evidence_ids??[]),
 authority:'PURSE_LEARNING_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
})
const profileFromRow=(r:ProfileRow):PurseStrategyLearningProfile=>Object.freeze({
 profileId:r.profile_id,lane:r.lane,strategyId:r.strategy_id,sampleSize:r.sample_size,meanReturnBps:r.mean_return_bps,winRateBps:r.win_rate_bps,downsideRateBps:r.downside_rate_bps,
 meanDecisionQualityBps:r.mean_decision_quality_bps,meanExecutionQualityBps:r.mean_execution_quality_bps,supportedThesisRateBps:r.supported_thesis_rate_bps,
 invalidatedThesisRateBps:r.invalidated_thesis_rate_bps,evidenceStrengthBps:r.evidence_strength_bps,confidenceAdjustmentBps:r.confidence_adjustment_bps,
 sizingMultiplierBps:r.sizing_multiplier_bps,disposition:r.disposition,lessonTags:Object.freeze(r.lesson_tags??[]),episodeIds:Object.freeze(r.episode_ids??[]),evidenceIds:Object.freeze(r.evidence_ids??[]),
 calibratedAt:iso(r.calibrated_at),authority:'PURSE_LEARNING_PROFILE_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
})
const temperamentFromRow=(r:TemperamentRow):PurseFinancialTemperament=>Object.freeze({
 temperamentId:r.temperament_id,personalityVersion:r.personality_version,cashPatienceBps:r.cash_patience_bps,evidenceDisciplineBps:r.evidence_discipline_bps,explorationBps:r.exploration_bps,
 lossSensitivityBps:r.loss_sensitivity_bps,independentAssessmentRequired:r.independent_assessment_required,livePersonalityRiskBoostAllowed:false,paperExplorationOnly:true,
 explanationStyle:r.explanation_style,derivedAt:iso(r.derived_at),evidenceIds:Object.freeze(r.evidence_ids??[]),authority:'PURSE_TEMPERAMENT_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
})

export class PostgresPurseLearningStore implements PurseLearningStore{
 private readonly episodes:string
 private readonly profiles:string
 private readonly temperaments:string
 constructor(private readonly client:SqlClient,options?:{episodesTable?:string;profilesTable?:string;temperamentsTable?:string}){
  this.episodes=safeTable(options?.episodesTable??'money_purse_learning_episodes')
  this.profiles=safeTable(options?.profilesTable??'money_purse_learning_profiles')
  this.temperaments=safeTable(options?.temperamentsTable??'money_purse_financial_temperaments')
 }
 async appendEpisode(userId:string,cofferId:string,e:PurseLearningEpisode):Promise<'INSERTED'|'REPLAY'>{
  assertAuthority(e,'PURSE_LEARNING_STORE_EPISODE_AUTHORITY_INVALID')
  const r=await this.client.query<{episode_id:string}>(`INSERT INTO ${this.episodes}
   (episode_id,user_id,coffer_id,source,source_record_id,lane,strategy_id,instrument_id,scenario_id,return_bps,decision_quality_bps,execution_quality_bps,downside_occurred,thesis_disposition,sizing_diagnosis,lesson_tags,observed_at,evidence_ids)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::text[],$17,$18::text[]) ON CONFLICT(episode_id) DO NOTHING RETURNING episode_id`,
   [e.episodeId,userId,cofferId,e.source,e.sourceRecordId,e.lane,e.strategyId,e.instrumentId??null,e.scenarioId??null,e.returnBps,e.decisionQualityBps,e.executionQualityBps,e.downsideOccurred,e.thesisDisposition,e.sizingDiagnosis,[...e.lessonTags],e.observedAt,[...e.evidenceIds]])
  return r.rows[0]?'INSERTED':'REPLAY'
 }
 async listEpisodes(userId:string,lane:string,strategyId:string,limit=500):Promise<readonly PurseLearningEpisode[]>{
  if(!Number.isInteger(limit)||limit<1||limit>5000)throw new Error('PURSE_LEARNING_STORE_LIMIT_INVALID')
  const r=await this.client.query<EpisodeRow>(`SELECT * FROM ${this.episodes} WHERE user_id=$1 AND lane=$2 AND strategy_id=$3 ORDER BY observed_at DESC,episode_id DESC LIMIT $4`,[userId,lane,strategyId,limit])
  return Object.freeze(r.rows.map(episodeFromRow))
 }
 async appendProfile(userId:string,cofferId:string,p:PurseStrategyLearningProfile):Promise<'INSERTED'|'REPLAY'>{
  assertAuthority(p,'PURSE_LEARNING_STORE_PROFILE_AUTHORITY_INVALID')
  const r=await this.client.query<{profile_id:string}>(`INSERT INTO ${this.profiles}
   (profile_id,user_id,coffer_id,lane,strategy_id,sample_size,mean_return_bps,win_rate_bps,downside_rate_bps,mean_decision_quality_bps,mean_execution_quality_bps,supported_thesis_rate_bps,invalidated_thesis_rate_bps,evidence_strength_bps,confidence_adjustment_bps,sizing_multiplier_bps,disposition,lesson_tags,episode_ids,evidence_ids,calibrated_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::text[],$19::text[],$20::text[],$21) ON CONFLICT(profile_id) DO NOTHING RETURNING profile_id`,
   [p.profileId,userId,cofferId,p.lane,p.strategyId,p.sampleSize,p.meanReturnBps,p.winRateBps,p.downsideRateBps,p.meanDecisionQualityBps,p.meanExecutionQualityBps,p.supportedThesisRateBps,p.invalidatedThesisRateBps,p.evidenceStrengthBps,p.confidenceAdjustmentBps,p.sizingMultiplierBps,p.disposition,[...p.lessonTags],[...p.episodeIds],[...p.evidenceIds],p.calibratedAt])
  return r.rows[0]?'INSERTED':'REPLAY'
 }
 async latestProfile(userId:string,lane:string,strategyId:string):Promise<PurseStrategyLearningProfile|undefined>{
  const r=await this.client.query<ProfileRow>(`SELECT * FROM ${this.profiles} WHERE user_id=$1 AND lane=$2 AND strategy_id=$3 ORDER BY calibrated_at DESC,profile_id DESC LIMIT 1`,[userId,lane,strategyId])
  return r.rows[0]?profileFromRow(r.rows[0]):undefined
 }
 async appendTemperament(userId:string,cofferId:string,t:PurseFinancialTemperament):Promise<'INSERTED'|'REPLAY'>{
  assertAuthority(t,'PURSE_LEARNING_STORE_TEMPERAMENT_AUTHORITY_INVALID')
  const r=await this.client.query<{temperament_id:string}>(`INSERT INTO ${this.temperaments}
   (temperament_id,user_id,coffer_id,personality_version,cash_patience_bps,evidence_discipline_bps,exploration_bps,loss_sensitivity_bps,independent_assessment_required,live_personality_risk_boost_allowed,paper_exploration_only,explanation_style,derived_at,evidence_ids)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,TRUE,$10,$11,$12::text[]) ON CONFLICT(temperament_id) DO NOTHING RETURNING temperament_id`,
   [t.temperamentId,userId,cofferId,t.personalityVersion,t.cashPatienceBps,t.evidenceDisciplineBps,t.explorationBps,t.lossSensitivityBps,t.independentAssessmentRequired,t.explanationStyle,t.derivedAt,[...t.evidenceIds]])
  return r.rows[0]?'INSERTED':'REPLAY'
 }
 async latestTemperament(userId:string):Promise<PurseFinancialTemperament|undefined>{
  const r=await this.client.query<TemperamentRow>(`SELECT * FROM ${this.temperaments} WHERE user_id=$1 ORDER BY derived_at DESC,temperament_id DESC LIMIT 1`,[userId])
  return r.rows[0]?temperamentFromRow(r.rows[0]):undefined
 }
}
