import type {SocialObservation} from '@jhadina/social-core';
import {createSocialRepository,type SocialRepository} from '../social/repository';
import {createMusicJuggernautRepository,type MusicJuggernautRepository} from './music-juggernaut-repository';
import {createMusicSocialLineageRepository,type MusicSocialLineageRepository,type MusicSocialLineage} from './music-social-lineage-repository';

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
  const lineage=input.lineageRepository;
  const project=await repository.getProject(input.userId,input.artistKey);
  if(!project)return Object.freeze({synced:0,skipped:0,reasons:Object.freeze({project_missing:1}),evidenceRefs:Object.freeze([])});
  const projectId=String(project.id);
  const [experiments,observations]=await Promise.all([
    repository.listExperiments(input.userId,projectId),
    social.listObservations(input.userId),
  ]);
  const byKey=new Map(experiments.map((row)=>[String(row.experiment_key),row]));
  const outboxByProposal=new Map<string,Awaited<ReturnType<SocialRepository['listOutbox']>>>();
  const reasons:Record<string,number>={};
  const evidenceRefs:string[]=[];
  let synced=0,skipped=0;
  for(const observation of observations){
    if(observation.kind!=='performance'){skipped+=1;bump(reasons,'not_performance');continue;}
    if(observation.userId && observation.userId!==input.userId){
      skipped+=1;bump(reasons,'observation_owner_mismatch');continue;
    }
    const binding=await verifiedMusicLineage(observation,input.userId,projectId,lineage);
    if(!binding){skipped+=1;bump(reasons,'no_music_experiment_lineage');continue;}
    let providerOutbox=outboxByProposal.get(observation.proposalId!);
    if(!providerOutbox){
      providerOutbox=await social.listOutbox(input.userId,observation.proposalId!);
      outboxByProposal.set(observation.proposalId!,providerOutbox);
    }
    const matched=providerOutbox.some((job)=>
      job.id===observation.outboxId&&job.userId===input.userId&&
      job.proposalId===observation.proposalId&&job.status==='delivered'&&
      job.providerPostId===observation.contentId&&
      job.target.platform===observation.platform&&
      (!observation.accountId||job.target.accountId===observation.accountId)&&
      (!observation.provider||job.target.provider===observation.provider)
    );
    if(!matched){skipped+=1;bump(reasons,'provider_post_outbox_mismatch');continue;}
    const experiment=byKey.get(binding.experimentKey);
    if(!experiment){skipped+=1;bump(reasons,'experiment_not_found');continue;}
    if(String(experiment.song_id)!==binding.songId||
       String(experiment.platform)!==observation.platform){
      skipped+=1;bump(reasons,'song_or_platform_mismatch');continue;
    }
    const metrics=musicMetrics(observation);
    if(metrics.exposures<=0){skipped+=1;bump(reasons,'no_exposure_metric');continue;}
    const evidence=[...new Set([...observation.evidence,...binding.evidenceRefs,
      'social-observation:'+observation.id,
      'social-proposal:'+observation.proposalId,
      'social-outbox:'+observation.outboxId,
      'social-post:'+observation.contentId])];
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

/** Provider metrics never get to self-assert experiment provenance.
 * Read an owner-scoped, durable Music->Social proposal link, then verify that
 * the observed outbox/post resolves to the exact linked artist asset & song.
 * Canonical Social owns the actual provider delivery truth. */
async function verifiedMusicLineage(
  observation:SocialObservation,
  userId:string,
  projectId:string,
  lineage?:MusicSocialLineageRepository,
):Promise<MusicSocialLineage|null>{
  if(!observation.proposalId||!observation.outboxId||!observation.contentId||
     !observation.evidence.length)return null;
  const repository=lineage??createMusicSocialLineageRepository();
  const linked=await repository.resolve(userId,observation.proposalId);
  if(!linked||linked.userId!==userId||linked.projectId!==projectId||
     linked.proposalId!==observation.proposalId||!linked.songId||!linked.briefId||
     !linked.evidenceRefs.some((ref)=>ref.startsWith('director-asset:'))||
     !linked.evidenceRefs.some((ref)=>ref.startsWith('director-approval:')))return null;
  const asserted=observation.attributes?.musicExperimentKey;
  if(asserted!==undefined&&asserted!==linked.experimentKey)return null;
  return linked;
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
