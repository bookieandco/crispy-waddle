import type { MoneyStrategyLane } from './money-commissioning-contracts.js'
import type { PurseAutonomyMode } from './jhadina-purse-charter.js'
import type { StrategyLearningRecord } from './autonomous-strategy-learning.js'
import type { SportsLearningEpisode } from './sports-learning-memory.js'
import {
 buildPurseLearningContext,
 buildPurseStrategyLearningProfile,
 derivePurseFinancialTemperament,
 purseLearningFromShark,
 purseLearningFromSportsEpisode,
 purseLearningFromStrategyRecord,
 type PurseLearningContext,
 type PursePersonalitySnapshot,
 type PurseSharkLearningInput,
 type PurseStrategyLearningProfile,
} from './purse-learning-memory.js'
import type { PurseLearningStore } from './purse-learning-store.js'

export type PurseStrategyRef=Readonly<{lane:MoneyStrategyLane;strategyId:string}>

export type PurseLearningIngestReceipt=Readonly<{
 source:'MONEY_PAPER'|'SHARK'|'SPORTS'
 episodeId:string
 profileId:string
 disposition:'INSERTED'|'REPLAY'
 recalibratedAt:string
 authority:'PURSE_LEARNING_COORDINATION_ONLY'
 financialAuthority:'NONE'
 canAuthorizeLive:false
 canExecute:false
}>

export class PurseLearningRuntime{
 constructor(private readonly deps:{
  userId:string
  cofferId:string
  store:PurseLearningStore
  minimumSamples?:number
 }){}

 private async recalibrate(lane:MoneyStrategyLane,strategyId:string,now:string):Promise<PurseStrategyLearningProfile>{
  const episodes=await this.deps.store.listEpisodes(this.deps.userId,lane,strategyId,5000)
  const profile=buildPurseStrategyLearningProfile({lane,strategyId,episodes,calibratedAt:now,minimumSamples:this.deps.minimumSamples})
  await this.deps.store.appendProfile(this.deps.userId,this.deps.cofferId,profile)
  return profile
 }

 async ingestPaper(record:StrategyLearningRecord,now=record.evaluatedAt):Promise<PurseLearningIngestReceipt>{
  const episode=purseLearningFromStrategyRecord(record)
  const disposition=await this.deps.store.appendEpisode(this.deps.userId,this.deps.cofferId,episode)
  const profile=await this.recalibrate(episode.lane,episode.strategyId,now)
  return Object.freeze({
   source:'MONEY_PAPER',episodeId:episode.episodeId,profileId:profile.profileId,disposition,recalibratedAt:now,
   authority:'PURSE_LEARNING_COORDINATION_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
  })
 }

 async ingestSports(episodeInput:SportsLearningEpisode,now=episodeInput.resolvedAt):Promise<PurseLearningIngestReceipt>{
  const episode=purseLearningFromSportsEpisode(episodeInput)
  const disposition=await this.deps.store.appendEpisode(this.deps.userId,this.deps.cofferId,episode)
  const profile=await this.recalibrate(episode.lane,episode.strategyId,now)
  return Object.freeze({
   source:'SPORTS',episodeId:episode.episodeId,profileId:profile.profileId,disposition,recalibratedAt:now,
   authority:'PURSE_LEARNING_COORDINATION_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
  })
 }

 async ingestShark(record:PurseSharkLearningInput,now=record.createdAt):Promise<PurseLearningIngestReceipt>{
  const episode=purseLearningFromShark(record)
  const disposition=await this.deps.store.appendEpisode(this.deps.userId,this.deps.cofferId,episode)
  const profile=await this.recalibrate(episode.lane,episode.strategyId,now)
  return Object.freeze({
   source:'SHARK',episodeId:episode.episodeId,profileId:profile.profileId,disposition,recalibratedAt:now,
   authority:'PURSE_LEARNING_COORDINATION_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
  })
 }

 async buildDecisionContext(input:{
  strategies:readonly PurseStrategyRef[]
  personality:PursePersonalitySnapshot
  autonomyMode:PurseAutonomyMode
  observedAt:string
  personalityEvidenceIds:readonly string[]
 }):Promise<PurseLearningContext>{
  const profiles:PurseStrategyLearningProfile[]=[]
  for(const ref of input.strategies){
   const profile=await this.deps.store.latestProfile(this.deps.userId,ref.lane,ref.strategyId)
   if(profile)profiles.push(profile)
  }
  const temperament=derivePurseFinancialTemperament({
   personality:input.personality,profiles,autonomyMode:input.autonomyMode,derivedAt:input.observedAt,evidenceIds:input.personalityEvidenceIds,
  })
  await this.deps.store.appendTemperament(this.deps.userId,this.deps.cofferId,temperament)
  return buildPurseLearningContext({profiles,temperament,observedAt:input.observedAt})
 }
}

export function createPurseSharkLearningCallback(runtime:PurseLearningRuntime){
 return async(record:PurseSharkLearningInput):Promise<void>=>{await runtime.ingestShark(record)}
}

export function createPurseSportsLearningCallback(runtime:PurseLearningRuntime){
 return async(episode:SportsLearningEpisode):Promise<void>=>{await runtime.ingestSports(episode)}
}

export function createPursePaperLearningCallback(runtime:PurseLearningRuntime){
 return async(record:StrategyLearningRecord):Promise<void>=>{await runtime.ingestPaper(record)}
}
