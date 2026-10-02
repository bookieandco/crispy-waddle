import type {SupabaseClient} from '@supabase/supabase-js';
import {ensureMusicJuggernautProject,loadMusicJuggernautProjection} from './music-juggernaut-service';
import {createMusicJuggernautRepository,type MusicJuggernautRepository} from './music-juggernaut-repository';
import {syncMusicObservationsFromSocial,type MusicSocialSyncReceipt} from './music-social-observation-sync';
import type {SocialRepository} from '../social/repository';
import type {MusicSocialLineageRepository} from './music-social-lineage-repository';

export interface MusicJuggernautTickAction{
  priority:number;
  kind:'INGEST_CATALOG'|'CREATE'|'BREAKOUT'|'OWNED_AUDIENCE'|'LIVE'|'RIGHTS'|'LEARN';
  instruction:string;
  reason:string;
  authority:'INTERNAL_PLANNING_ONLY';
  evidenceRefs:readonly string[];
}

export interface MusicJuggernautTickReceipt{
  artistKey:string;
  projectId:string;
  mode:'SEARCH'|'ATTACK';
  socialSync:MusicSocialSyncReceipt;
  admittedLearningKeys:readonly string[];
  actions:readonly MusicJuggernautTickAction[];
  externalActionsStarted:false;
}

export async function runMusicJuggernautTick(input:{
  userId:string;
  artistKey?:string;
  artistName?:string;
},overrides:{repository?:MusicJuggernautRepository;socialRepository?:SocialRepository;lineageRepository?:MusicSocialLineageRepository;client?:SupabaseClient}={}):Promise<MusicJuggernautTickReceipt>{
  const artistKey=input.artistKey?.trim()||'atwood-bookie';
  const artistName=input.artistName?.trim()||'Atwood Bookie';
  const repository=overrides.repository??createMusicJuggernautRepository();
  const project=await ensureMusicJuggernautProject({userId:input.userId,artistKey,artistName,repository});
  const socialSync=await syncMusicObservationsFromSocial({
    userId:input.userId,artistKey,repository,socialRepository:overrides.socialRepository,lineageRepository:overrides.lineageRepository,
  });
  const projection=await loadMusicJuggernautProjection({userId:input.userId,artistKey,repository,client:overrides.client});
  if(!projection)throw new Error('MUSIC_JUGGERNAUT_TICK_PROJECT_MISSING');

  const admittedLearningKeys:string[]=[];
  for(const outlier of projection.outliers.filter((item)=>item.status==='validated')){
    const key='validated-outlier:'+outlier.experimentId;
    await repository.upsertLearning({
      projectId:String(project.id),
      learningKey:key,
      status:'validated',
      confidence:outlier.confidence,
      finding:'Experiment '+outlier.experimentId+' produced a replicated relative performance outlier; preserve the winning mechanics while testing adjacent variants.',
      reusableSignals:{experimentId:outlier.experimentId,relativeLift:outlier.relativeLift},
      evidenceRefs:[...outlier.evidenceRefs],
    });
    admittedLearningKeys.push(key);
  }

  const actions:MusicJuggernautTickAction[]=[];
  if(!projection.rankedSongs.length){
    actions.push(action(1,'INGEST_CATALOG','Ingest the active catalog and map candidate song sections.','The system cannot learn which music to push without song-level lineage.',[]));
  }else if(projection.creativePortfolio){
    for(const [index,brief] of projection.creativePortfolio.briefs.slice(0,3).entries()){
      actions.push(action(index+1,'CREATE',brief.capturePlan,'Content Factory selected '+brief.family+' for '+projection.mode+' mode.',brief.evidenceRefs));
    }
  }
  const validated=projection.outliers.filter((item)=>item.status==='validated');
  if(validated.length){
    actions.push(action(2,'BREAKOUT','Feed the validated winner, prepare follow-up music/content, and collect real proof now.','Validated relative outlier(s) opened an attack opportunity.',validated.flatMap((item)=>item.evidenceRefs)));
  }
  if(projection.fanAudience&&projection.fanAudience.total>0&&projection.fanAudience.ownedShare<0.25){
    actions.push(action(3,'OWNED_AUDIENCE','Add a value-first direct-fan capture path to the current campaign.','Most known fan records are still platform-dependent.',projection.fanAudience.evidenceRefs));
  }
  const venue=[...projection.venues].sort((a,b)=>b.confidence-a.confidence)[0];
  if(venue&&venue.confidence>=0.25){
    const row=projection.cityDemand.find((item)=>String(item.city_name)===venue.city);
    actions.push(action(4,'LIVE','Evaluate a roughly '+venue.recommendedCapacity+'-capacity live test in '+venue.city+'.','Geographic demand crossed the planning threshold.',row?evidence(row):[]));
  }
  const rightsReview=projection.rights.filter((row)=>row.master_ownership_known!==true||row.publishing_known!==true||row.sample_status==='review_required'||row.third_party_usage_status==='review_required'||row.sample_status==='blocked'||row.third_party_usage_status==='blocked');
  if(rightsReview.length){
    actions.push(action(1,'RIGHTS','Resolve '+rightsReview.length+' rights record(s) before aggressive commercial scaling.','Unknown or blocked rights must fail closed.',rightsReview.flatMap(evidence)));
  }
  if(admittedLearningKeys.length){
    actions.push(action(5,'LEARN','Reuse admitted winning mechanics in adjacent experiments without assuming they generalize to every song.','Replicated outlier evidence was admitted to durable Music learning.',validated.flatMap((item)=>item.evidenceRefs)));
  }

  const ordered=actions.sort((a,b)=>a.priority-b.priority).slice(0,7);
  return Object.freeze({
    artistKey,projectId:String(project.id),mode:projection.mode,socialSync,
    admittedLearningKeys:Object.freeze(admittedLearningKeys),
    actions:Object.freeze(ordered),
    externalActionsStarted:false,
  });
}

function action(priority:number,kind:MusicJuggernautTickAction['kind'],instruction:string,reason:string,evidenceRefs:readonly string[]):MusicJuggernautTickAction{
  return Object.freeze({priority,kind,instruction,reason,authority:'INTERNAL_PLANNING_ONLY',evidenceRefs:Object.freeze([...new Set(evidenceRefs)])});
}
function evidence(row:Record<string,unknown>):string[]{
  const refs=Array.isArray(row.evidence_refs)?row.evidence_refs.map(String).filter(Boolean):[];
  return refs.length?refs:['music-record:'+String(row.id??'unknown')];
}
