import type {SocialObservation} from '@jhadina/social-core';
import {createSocialRepository,type SocialRepository} from '../social/repository';
import {createMusicJuggernautRepository,type MusicJuggernautRepository} from './music-juggernaut-repository';
import {createMusicSocialLineageRepository,type MusicSocialLineageRepository} from './music-social-lineage-repository';

export interface MusicSocialSyncReceipt{
  synced:number;
  skipped:number;
  reasons:Readonly<Record<string,number>>;
  evidenceRefs:readonly string[];
}

export async function syncMusicObservationsFromSocial(input:{
  userId:string;
  artistKey:string;
  repository?:MusicJuggernautRepository;
  socialRepository?:SocialRepository;
  lineageRepository?:MusicSocialLineageRepository;
}):Promise<MusicSocialSyncReceipt>{
  const repository=input.repository??createMusicJuggernautRepository();
  const social=input.socialRepository??createSocialRepository();
  const lineage=input.lineageRepository??createMusicSocialLineageRepository();
  const project=await repository.getProject(input.userId,input.artistKey);
  if(!project)return Object.freeze({synced:0,skipped:0,reasons:Object.freeze({project_missing:1}),evidenceRefs:Object.freeze([])});
  const projectId=String(project.id);
  const [experiments,observations]=await Promise.all([
    repository.listExperiments(input.userId,projectId),
    social.listObservations(input.userId),
  ]);
  const byKey=new Map(experiments.map((row)=>[String(row.experiment_key),row]));
  const reasons:Record<string,number>={};
  const evidenceRefs:string[]=[];
  let synced=0,skipped=0;
  for(const observation of observations){
    if(observation.kind!=='performance'){skipped+=1;bump(reasons,'not_performance');continue;}
    const key=await musicExperimentKey(observation,input.userId,projectId,lineage);
    if(!key){skipped+=1;bump(reasons,'no_music_experiment_lineage');continue;}
    const experiment=byKey.get(key);
    if(!experiment){skipped+=1;bump(reasons,'experiment_not_found');continue;}
    const metrics=musicMetrics(observation);
    if(metrics.exposures<=0){skipped+=1;bump(reasons,'no_exposure_metric');continue;}
    const evidence=[...new Set([...observation.evidence,'social-observation:'+observation.id])];
    await repository.recordObservation({
      projectId,
      experimentId:String(experiment.id),
      observationKey:'social:'+observation.id,
      observedAt:observation.observedAt,
      metrics,
      botRisk:attributeRate(observation,'musicBotRisk',0),
      attributionConfidence:attributeRate(observation,'musicAttributionConfidence',0.8),
      evidenceRefs:evidence,
    });
    synced+=1;evidenceRefs.push(...evidence);
  }
  return Object.freeze({synced,skipped,reasons:Object.freeze(reasons),evidenceRefs:Object.freeze([...new Set(evidenceRefs)])});
}

async function musicExperimentKey(
  observation:SocialObservation,
  userId:string,
  projectId:string,
  lineage:MusicSocialLineageRepository,
):Promise<string|undefined>{
  const value=observation.attributes?.musicExperimentKey;
  if(typeof value==='string'&&value.trim())return value.trim();
  if(!observation.proposalId)return undefined;
  const linked=await lineage.resolve(userId,observation.proposalId);
  if(!linked||linked.projectId!==projectId)return undefined;
  return linked.experimentKey;
}

function musicMetrics(observation:SocialObservation):Record<string,number>{
  const m=observation.metrics??{};
  const first=(...keys:string[])=>{
    for(const key of keys){const value=m[key];if(Number.isFinite(value)&&Number(value)>=0)return Number(value);}
    return 0;
  };
  const views=first('views','video_views');
  return {
    exposures:first('exposures','impressions')||views,
    views,
    shares:first('shares'),
    saves:first('saves'),
    comments:first('comments'),
    profileVisits:first('profile_visits'),
    songActions:first('song_actions','music_actions'),
    directFanCaptures:first('direct_fan_captures','owned_fan_captures'),
    purchases:first('purchases'),
    revenueMinor:first('revenue_minor'),
  };
}

function attributeRate(observation:SocialObservation,key:string,fallback:number):number{
  const value=observation.attributes?.[key];
  return typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
}
function bump(record:Record<string,number>,key:string):void{record[key]=(record[key]??0)+1;}
