import {
  buildMusicVisualProductionPlan,
  type MusicVisualAspectRatio,
  type MusicVisualDeliverable,
  type MusicVisualSongSection,
} from '@jhadina/director-core/music-visual-production';
import type {TranscriptCue} from '@jhadina/director-core/transcript-assisted-lip-sync';
import {createAndSubmitAskVideoJob,type AskVideoJobResult} from '@/lib/director-video-job-service';
import {createMusicCommissioningRepository,type MusicCommissioningRepository} from './music-commissioning-repository';
import {createMusicJuggernautRepository,type MusicJuggernautRepository} from './music-juggernaut-repository';
import {ATWOOD_BOOKIE_ARTIST_KEY} from '@jhadina/growth-core';

type Row=Record<string,unknown>;

export interface MusicDirectorReferenceAsset {
  id:string;
  uri:string;
}

export interface CreateMusicDirectorPackageInput {
  userId:string;
  songKey:string;
  deliverable:MusicVisualDeliverable;
  audioAssetId:string;
  audioUri:string;
  audioDurationSeconds:number;
  vocalStemAssetId?:string;
  vocalStemUri?:string;
  timedLyrics?:readonly TranscriptCue[];
  concept:string;
  styleReferenceAssets?:readonly MusicDirectorReferenceAsset[];
  artistReferenceAssets?:readonly MusicDirectorReferenceAsset[];
  targetAspectRatios?:readonly MusicVisualAspectRatio[];
  targetTeaserCount?:number;
  lipSyncRequested?:boolean;
  lyricOverlayRequested?:boolean;
  characterPerformanceRequested?:boolean;
  createStyleFrames?:boolean;
  experimentKey?:string;
  parentDirectorJobId?:string;
  submit?:boolean;
}

export interface MusicDirectorPackageReceipt {
  musicProjectId:string;
  songId:string;
  songKey:string;
  directorProjectId:string;
  plan:ReturnType<typeof buildMusicVisualProductionPlan>;
  jobs:readonly AskVideoJobResult[];
  persistedVisualJobs:readonly Row[];
  providerExecutionAttempted:boolean;
  externalPublishStarted:false;
  paidGenerationAuthorized:false;
  warnings:readonly string[];
}

export async function createMusicDirectorPackage(
  input:CreateMusicDirectorPackageInput,
  overrides:{
    musicRepository?:MusicJuggernautRepository;
    commissionRepository?:MusicCommissioningRepository;
    submitVideoJob?:(input:Parameters<typeof createAndSubmitAskVideoJob>[0])=>Promise<AskVideoJobResult>;
  }={},
):Promise<MusicDirectorPackageReceipt>{
  const musicRepository=overrides.musicRepository??createMusicJuggernautRepository();
  const commissionRepository=overrides.commissionRepository??createMusicCommissioningRepository();
  const submitVideoJob=overrides.submitVideoJob??createAndSubmitAskVideoJob;
  const project=await musicRepository.getProject(input.userId,ATWOOD_BOOKIE_ARTIST_KEY);
  if(!project)throw new Error('MUSIC_DIRECTOR_PROJECT_NOT_COMMISSIONED');
  const musicProjectId=String(project.id);

  const [songs,experiments,rights]=await Promise.all([
    musicRepository.listSongs(input.userId,musicProjectId),
    musicRepository.listExperiments(input.userId,musicProjectId),
    musicRepository.listRights(input.userId,musicProjectId),
  ]);
  const song=songs.find((row)=>String(row.song_key).toLowerCase()===input.songKey.trim().toLowerCase());
  if(!song)throw new Error('MUSIC_DIRECTOR_SONG_NOT_FOUND');
  const songId=String(song.id);
  const experiment=input.experimentKey
    ?experiments.find((row)=>String(row.experiment_key)===input.experimentKey)
    :undefined;
  const rightsRow=rights.find((row)=>String(row.asset_key)===String(song.song_key));
  const rightsEvidence=evidence(rightsRow,'music-rights');

  const styleAssets=validatedAssets(input.styleReferenceAssets??[],'STYLE');
  const artistAssets=validatedAssets(input.artistReferenceAssets??[],'ARTIST');
  const planId='music-director:'+musicProjectId+':'+songId+':'+input.deliverable;
  const directorProjectId='director:music:'+musicProjectId+':'+songId;
  const sections=parseSections(song.sections,songId);

  const plan=buildMusicVisualProductionPlan({
    id:planId,
    directorProjectId,
    deliverable:input.deliverable,
    source:{
      musicProjectId,
      songId,
      songTitle:String(song.title??song.song_key),
      audioAssetId:input.audioAssetId,
      audioDurationSeconds:input.audioDurationSeconds,
      ...(input.vocalStemAssetId?{vocalStemAssetId:input.vocalStemAssetId}:{}),
      timedLyrics:input.timedLyrics??[],
      songSections:sections,
      styleReferenceAssetIds:styleAssets.map((item)=>item.id),
      artistReferenceAssetIds:artistAssets.map((item)=>item.id),
      rightsEvidenceIds:rightsEvidence,
      campaignEvidenceIds:unique([
        ...evidence(song,'music-song'),
        ...(experiment?evidence(experiment,'music-experiment'):[]),
      ]),
    },
    concept:input.concept,
    targetAspectRatios:input.targetAspectRatios,
    targetTeaserCount:input.targetTeaserCount,
    lipSyncRequested:input.lipSyncRequested,
    lyricOverlayRequested:input.lyricOverlayRequested,
    characterPerformanceRequested:input.characterPerformanceRequested,
    createStyleFrames:input.createStyleFrames,
  });

  const persisted:Row[]=[];
  const jobs:AskVideoJobResult[]=[];
  const warnings=[...plan.warnings];
  let projectForJobs=directorProjectId;
  let parentDirectorJobId=input.parentDirectorJobId;

  for(const [index,segment] of plan.segments.entries()){
    let state:Parameters<MusicCommissioningRepository['upsertVisualJob']>[0]['status']=
      plan.status==='READY'?'planned':'data_required';
    let directorJobId:string|undefined;
    let outputAssetIds:string[]=[];

    if(plan.status==='READY'&&input.submit!==false){
      const timedLyrics=clipLyrics(input.timedLyrics??[],segment.startSeconds,segment.endSeconds);
      const activeTask=videoPrompt({
        deliverable:input.deliverable,
        songTitle:String(song.title??song.song_key),
        concept:input.concept,
        durationSeconds:segment.endSeconds-segment.startSeconds,
        aspectRatio:segment.aspectRatio,
        lyrics:plan.stages.includes('lyrics'),
        lipSync:plan.stages.includes('lip_sync'),
        derivative:segment.role==='teaser',
        derivativeIndex:segment.role==='teaser'?index:undefined,
      });
      const job=await submitVideoJob({
        userId:input.userId,
        activeTask,
        activeProject:projectForJobs,
        clientRequestId:'music-director:'+plan.id+':'+segment.id,
        musicProduction:{
          deliverable:input.deliverable,
          songId,
          songTitle:String(song.title??song.song_key),
          audioAssetId:input.audioAssetId,
          audioUri:input.audioUri,
          ...(input.vocalStemAssetId?{vocalStemAssetId:input.vocalStemAssetId}:{}),
          ...(input.vocalStemUri?{vocalStemUri:input.vocalStemUri}:{}),
          sourceStartSeconds:segment.startSeconds,
          sourceEndSeconds:segment.endSeconds,
          timedLyrics,
          styleReferenceAssetIds:styleAssets.map((item)=>item.id),
          styleReferenceUris:styleAssets.map((item)=>item.uri),
          artistReferenceAssetIds:artistAssets.map((item)=>item.id),
          artistReferenceUris:artistAssets.map((item)=>item.uri),
          derivativeIndex:segment.role==='teaser'?index:undefined,
          derivativeCount:plan.segments.filter((item)=>item.role==='teaser').length||undefined,
          evidenceIds:[...plan.evidenceIds],
          lipSyncRequested:plan.stages.includes('lip_sync'),
        },
      });
      jobs.push(job);
      directorJobId=job.job.id;
      projectForJobs=job.job.projectId;
      if(!parentDirectorJobId&&segment.role!=='teaser')parentDirectorJobId=job.job.id;
      outputAssetIds=[...job.job.outputAssetIds];
      state=mapDirectorStatus(job.job.status);
      if(job.job.error)warnings.push(job.job.error);
    }

    persisted.push(await commissionRepository.upsertVisualJob({
      projectId:musicProjectId,
      songId,
      experimentId:experiment?String(experiment.id):undefined,
      planId:plan.id,
      segmentId:segment.id,
      deliverable:input.deliverable,
      directorProjectId:projectForJobs,
      directorJobId,
      parentDirectorJobId:segment.role==='teaser'?parentDirectorJobId:undefined,
      sourceAudioAssetId:input.audioAssetId,
      vocalStemAssetId:input.vocalStemAssetId,
      status:state,
      styleReferenceAssetIds:styleAssets.map((item)=>item.id),
      artistReferenceAssetIds:artistAssets.map((item)=>item.id),
      outputAssetIds,
      evidenceRefs:[...plan.evidenceIds],
      metadata:{
        segmentRole:segment.role,
        startSeconds:segment.startSeconds,
        endSeconds:segment.endSeconds,
        aspectRatio:segment.aspectRatio,
        lyricCueIds:[...segment.lyricCueIds],
        sectionIds:[...segment.sectionIds],
        publicationAuthority:'NONE',
        paidGenerationAuthority:'NONE',
      },
    }));
  }

  return Object.freeze({
    musicProjectId,
    songId,
    songKey:String(song.song_key),
    directorProjectId:projectForJobs,
    plan,
    jobs:Object.freeze(jobs),
    persistedVisualJobs:Object.freeze(persisted),
    providerExecutionAttempted:plan.status==='READY'&&input.submit!==false,
    externalPublishStarted:false,
    paidGenerationAuthorized:false,
    warnings:Object.freeze(unique(warnings)),
  });
}

function videoPrompt(input:{
  deliverable:MusicVisualDeliverable;
  songTitle:string;
  concept:string;
  durationSeconds:number;
  aspectRatio:MusicVisualAspectRatio;
  lyrics:boolean;
  lipSync:boolean;
  derivative:boolean;
  derivativeIndex?:number;
}):string{
  const noun=input.deliverable==='lyric_video'?'lyric video':
    input.deliverable==='visualizer'?'music visualizer':
    input.derivative?'short music teaser':'music video';
  return [
    'Create a '+noun+' for "'+input.songTitle+'".',
    input.concept.trim()+'.',
    'Use the supplied canonical song audio; no narration.',
    input.lyrics?'Use only the supplied timed lyrics; do not invent lyric text.':'No captions.',
    input.lipSync?'Use the supplied vocal stem and artist references for music lip sync.':'',
    input.derivative?'Preserve the visual identity of the master treatment and make this derivative independently usable on social.':'',
    'Duration '+round(input.durationSeconds)+' seconds.',
    'Aspect '+input.aspectRatio+'.',
  ].filter(Boolean).join(' ');
}

function clipLyrics(cues:readonly TranscriptCue[],startSeconds:number,endSeconds:number):TranscriptCue[]{
  const startMs=Math.round(startSeconds*1000);
  const endMs=Math.round(endSeconds*1000);
  return cues.filter((cue)=>cue.startMs<endMs&&cue.endMs>startMs).map((cue)=>({
    ...cue,
    startMs:Math.max(0,cue.startMs-startMs),
    endMs:Math.min(endMs-startMs,cue.endMs-startMs),
  })).filter((cue)=>cue.endMs>cue.startMs);
}

function parseSections(value:unknown,songId:string):MusicVisualSongSection[]{
  if(!Array.isArray(value))return [];
  return value.flatMap((raw)=>{
    if(!raw||typeof raw!=='object')return [];
    const row=raw as Row;
    const startMs=Number(row.startMs??row.start_ms);
    const endMs=Number(row.endMs??row.end_ms);
    const allowed=new Set(['lyric','melody','emotion','meme','performance','loop']);
    const functions=Array.isArray(row.functions)
      ?row.functions.map(String).filter((item)=>allowed.has(item)) as MusicVisualSongSection['functions'][number][]
      :[];
    if(!String(row.id??'').trim()||!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<0||endMs<=startMs||!functions.length)return [];
    return [{
      id:String(row.id),songId,startMs,endMs,label:String(row.label??row.id),functions,
    }];
  });
}

function validatedAssets(values:readonly MusicDirectorReferenceAsset[],kind:string):MusicDirectorReferenceAsset[]{
  return values.map((item)=>{
    if(!item.id.trim()||!item.uri.trim())throw new Error('MUSIC_DIRECTOR_'+kind+'_REFERENCE_INVALID');
    return {id:item.id.trim(),uri:item.uri.trim()};
  });
}

function mapDirectorStatus(status:AskVideoJobResult['job']['status']):
  Parameters<MusicCommissioningRepository['upsertVisualJob']>[0]['status']{
  if(status==='blocked')return 'blocked';
  if(status==='failed')return 'failed';
  if(status==='cancelled')return 'cancelled';
  if(status==='preview_ready')return 'preview_ready';
  if(status==='generating'||status==='ingesting')return 'generating';
  return 'submitted';
}

function evidence(row:Row|undefined,prefix:string):string[]{
  if(!row)return [];
  const refs=Array.isArray(row.evidence_refs)?row.evidence_refs.map(String).filter(Boolean):[];
  return refs.length?refs:[prefix+':'+String(row.id??'unknown')];
}
function unique(values:readonly string[]):string[]{
  return [...new Set(values.map((value)=>value.trim()).filter(Boolean))];
}
function round(value:number):number{return Math.round(value*1000)/1000;}
