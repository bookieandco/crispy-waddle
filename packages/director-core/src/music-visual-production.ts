import type {SongSection} from '@jhadina/growth-core';
import type {TranscriptCue} from './transcript-assisted-lip-sync.js';

export type MusicVisualDeliverable='lyric_video'|'teaser_pack'|'music_video'|'visualizer';
export type MusicVisualAspectRatio='16:9'|'9:16'|'1:1';

export interface MusicVisualSource {
  musicProjectId:string;
  songId:string;
  songTitle:string;
  audioAssetId:string;
  audioDurationSeconds:number;
  vocalStemAssetId?:string;
  timedLyrics?:readonly TranscriptCue[];
  songSections?:readonly SongSection[];
  styleReferenceAssetIds?:readonly string[];
  artistReferenceAssetIds?:readonly string[];
  rightsEvidenceIds:readonly string[];
  campaignEvidenceIds:readonly string[];
}

export interface MusicVisualRequest {
  id:string;
  directorProjectId:string;
  deliverable:MusicVisualDeliverable;
  source:MusicVisualSource;
  concept:string;
  targetAspectRatios?:readonly MusicVisualAspectRatio[];
  targetTeaserCount?:number;
  lipSyncRequested?:boolean;
  lyricOverlayRequested?:boolean;
  characterPerformanceRequested?:boolean;
  createStyleFrames?:boolean;
}

export interface MusicVisualSegment {
  id:string;
  role:'master'|'teaser'|'lyric-section'|'performance'|'visual';
  startSeconds:number;
  endSeconds:number;
  aspectRatio:MusicVisualAspectRatio;
  lyricCueIds:readonly string[];
  sectionIds:readonly string[];
  intent:string;
}

export interface MusicVisualProductionPlan {
  id:string;
  directorProjectId:string;
  musicProjectId:string;
  songId:string;
  deliverable:MusicVisualDeliverable;
  status:'READY'|'DATA_REQUIRED'|'BLOCKED';
  blockers:readonly string[];
  warnings:readonly string[];
  stages:readonly (
    |'audio_analysis'
    |'style_frames'
    |'creative_brief'
    |'storyboard'
    |'scene_generation'
    |'performance'
    |'lip_sync'
    |'lyrics'
    |'edit'
    |'derivative_shorts'
    |'media_qc'
    |'review'
    |'delivery'
  )[];
  segments:readonly MusicVisualSegment[];
  sourceAudioAssetId:string;
  vocalStemAssetId?:string;
  styleReferenceAssetIds:readonly string[];
  artistReferenceAssetIds:readonly string[];
  rightsEvidenceIds:readonly string[];
  evidenceIds:readonly string[];
  publicationAuthority:'NONE';
  paidGenerationAuthority:'NONE';
}

export interface MusicVisualClosedLoopCertification {
  passed:boolean;
  checks:readonly {name:string;passed:boolean}[];
  externalPublishStarted:false;
  paidGenerationStarted:false;
}

export function buildMusicVisualProductionPlan(request:MusicVisualRequest):MusicVisualProductionPlan {
  const blockers:string[]=[];
  const warnings:string[]=[];
  requireText(request.id,'DIRECTOR_MUSIC_VISUAL_ID_REQUIRED');
  requireText(request.directorProjectId,'DIRECTOR_MUSIC_VISUAL_PROJECT_REQUIRED');
  requireText(request.source.musicProjectId,'DIRECTOR_MUSIC_VISUAL_MUSIC_PROJECT_REQUIRED');
  requireText(request.source.songId,'DIRECTOR_MUSIC_VISUAL_SONG_REQUIRED');
  requireText(request.source.songTitle,'DIRECTOR_MUSIC_VISUAL_TITLE_REQUIRED');
  requireText(request.source.audioAssetId,'DIRECTOR_MUSIC_VISUAL_AUDIO_REQUIRED');
  requireText(request.concept,'DIRECTOR_MUSIC_VISUAL_CONCEPT_REQUIRED');
  if(!Number.isFinite(request.source.audioDurationSeconds)||request.source.audioDurationSeconds<=0){
    throw new Error('DIRECTOR_MUSIC_VISUAL_DURATION_INVALID');
  }
  if(!request.source.rightsEvidenceIds.length)blockers.push('DIRECTOR_MUSIC_VISUAL_RIGHTS_EVIDENCE_REQUIRED');
  if(!request.source.campaignEvidenceIds.length)warnings.push('DIRECTOR_MUSIC_VISUAL_CAMPAIGN_EVIDENCE_MISSING');

  const timedLyrics=validTimedLyrics(request.source.timedLyrics??[],request.source.audioDurationSeconds,blockers);
  const sections=validSections(request.source.songSections??[],request.source.songId,warnings);
  const ratios=aspectRatios(request);

  if(request.deliverable==='lyric_video' && timedLyrics.length===0){
    blockers.push('DIRECTOR_MUSIC_VISUAL_TIMED_LYRICS_REQUIRED');
  }
  if(request.lyricOverlayRequested && timedLyrics.length===0){
    blockers.push('DIRECTOR_MUSIC_VISUAL_TIMED_LYRICS_REQUIRED');
  }
  if(request.lipSyncRequested){
    if(!request.source.vocalStemAssetId?.trim())blockers.push('DIRECTOR_MUSIC_VISUAL_VOCAL_STEM_REQUIRED');
    if(timedLyrics.length===0)blockers.push('DIRECTOR_MUSIC_VISUAL_TIMED_LYRICS_REQUIRED');
    if(!(request.source.artistReferenceAssetIds?.length))blockers.push('DIRECTOR_MUSIC_VISUAL_ARTIST_REFERENCE_REQUIRED');
  }
  if(request.characterPerformanceRequested && !(request.source.artistReferenceAssetIds?.length)){
    blockers.push('DIRECTOR_MUSIC_VISUAL_ARTIST_REFERENCE_REQUIRED');
  }
  if(request.deliverable==='teaser_pack' && sections.length===0 && timedLyrics.length===0){
    blockers.push('DIRECTOR_MUSIC_VISUAL_TEASER_SOURCE_RANGE_REQUIRED');
  }

  const stages=stagesFor(request);
  const segments=segmentsFor(request,ratios,sections,timedLyrics,warnings);

  if(!segments.length)blockers.push('DIRECTOR_MUSIC_VISUAL_SEGMENTS_REQUIRED');

  return Object.freeze({
    id:request.id,
    directorProjectId:request.directorProjectId,
    musicProjectId:request.source.musicProjectId,
    songId:request.source.songId,
    deliverable:request.deliverable,
    status:blockers.length?'DATA_REQUIRED':'READY',
    blockers:Object.freeze(unique(blockers)),
    warnings:Object.freeze(unique(warnings)),
    stages:Object.freeze(stages),
    segments:Object.freeze(segments),
    sourceAudioAssetId:request.source.audioAssetId,
    ...(request.source.vocalStemAssetId?.trim()?{vocalStemAssetId:request.source.vocalStemAssetId.trim()}:{}),
    styleReferenceAssetIds:Object.freeze(unique(request.source.styleReferenceAssetIds??[])),
    artistReferenceAssetIds:Object.freeze(unique(request.source.artistReferenceAssetIds??[])),
    rightsEvidenceIds:Object.freeze(unique(request.source.rightsEvidenceIds)),
    evidenceIds:Object.freeze(unique([
      ...request.source.rightsEvidenceIds,
      ...request.source.campaignEvidenceIds,
      ...(request.source.styleReferenceAssetIds??[]).map((id)=>'style-ref:'+id),
      ...(request.source.artistReferenceAssetIds??[]).map((id)=>'artist-ref:'+id),
    ])),
    publicationAuthority:'NONE',
    paidGenerationAuthority:'NONE',
  });
}

export function certifyMusicDirectorClosedLoop():MusicVisualClosedLoopCertification {
  const timedLyrics:TranscriptCue[]=[
    {id:'line-1',startMs:0,endMs:4000,text:'first line',confidence:0.99},
    {id:'line-2',startMs:4000,endMs:8000,text:'second line',confidence:0.99},
  ];
  const section:SongSection={
    id:'section:hook',
    songId:'song-1',
    startMs:0,
    endMs:8000,
    label:'Hook',
    functions:['lyric','melody','loop'],
  };
  const common:MusicVisualSource={
    musicProjectId:'music:atwood-bookie',
    songId:'song-1',
    songTitle:'Example',
    audioAssetId:'audio:master',
    audioDurationSeconds:90,
    vocalStemAssetId:'audio:vocal',
    timedLyrics,
    songSections:[section],
    styleReferenceAssetIds:['style:1','style:2'],
    artistReferenceAssetIds:['artist:1'],
    rightsEvidenceIds:['rights:1'],
    campaignEvidenceIds:['campaign:1'],
  };
  const lyric=buildMusicVisualProductionPlan({
    id:'plan:lyric',directorProjectId:'director:1',deliverable:'lyric_video',source:common,
    concept:'kinetic lyric video',lyricOverlayRequested:true,createStyleFrames:true,
  });
  const teaser=buildMusicVisualProductionPlan({
    id:'plan:teaser',directorProjectId:'director:1',deliverable:'teaser_pack',source:common,
    concept:'six vertical teaser variations',targetTeaserCount:6,targetAspectRatios:['9:16'],
  });
  const musicVideo=buildMusicVisualProductionPlan({
    id:'plan:mv',directorProjectId:'director:1',deliverable:'music_video',source:common,
    concept:'cinematic performance narrative',lipSyncRequested:true,characterPerformanceRequested:true,createStyleFrames:true,
  });
  const missingLipSync=buildMusicVisualProductionPlan({
    id:'plan:blocked',directorProjectId:'director:1',deliverable:'music_video',
    source:{...common,vocalStemAssetId:undefined,timedLyrics:[],artistReferenceAssetIds:[]},
    concept:'performance',lipSyncRequested:true,characterPerformanceRequested:true,
  });
  const checks=[
    {name:'lyric-video-requires-real-timed-lyrics',passed:lyric.status==='READY'&&lyric.stages.includes('lyrics')},
    {name:'teaser-pack-derives-from-verified-song-range',passed:teaser.status==='READY'&&teaser.segments.filter((item)=>item.role==='teaser').length===6},
    {name:'music-video-supports-style-frames-scenes-performance-and-lipsync',passed:
      musicVideo.status==='READY'&&['style_frames','storyboard','scene_generation','performance','lip_sync','edit','derivative_shorts'].every((stage)=>musicVideo.stages.includes(stage as MusicVisualProductionPlan['stages'][number]))},
    {name:'lip-sync-fails-closed-without-vocal-lyrics-and-artist-reference',passed:
      missingLipSync.status==='DATA_REQUIRED'&&
      missingLipSync.blockers.includes('DIRECTOR_MUSIC_VISUAL_VOCAL_STEM_REQUIRED')&&
      missingLipSync.blockers.includes('DIRECTOR_MUSIC_VISUAL_TIMED_LYRICS_REQUIRED')&&
      missingLipSync.blockers.includes('DIRECTOR_MUSIC_VISUAL_ARTIST_REFERENCE_REQUIRED')},
    {name:'no-publish-or-paid-generation-authority',passed:
      lyric.publicationAuthority==='NONE'&&musicVideo.paidGenerationAuthority==='NONE'},
  ] as const;
  return Object.freeze({
    passed:checks.every((check)=>check.passed),
    checks:Object.freeze(checks.map((check)=>Object.freeze({...check}))),
    externalPublishStarted:false,
    paidGenerationStarted:false,
  });
}

function stagesFor(request:MusicVisualRequest):MusicVisualProductionPlan['stages'][number][] {
  const stages:MusicVisualProductionPlan['stages'][number][]=['audio_analysis'];
  if(request.createStyleFrames!==false)stages.push('style_frames');
  stages.push('creative_brief','storyboard','scene_generation');
  if(request.characterPerformanceRequested||request.lipSyncRequested)stages.push('performance');
  if(request.lipSyncRequested)stages.push('lip_sync');
  if(request.deliverable==='lyric_video'||request.lyricOverlayRequested)stages.push('lyrics');
  stages.push('edit');
  if(request.deliverable==='music_video'||request.deliverable==='teaser_pack')stages.push('derivative_shorts');
  stages.push('media_qc','review','delivery');
  return unique(stages) as MusicVisualProductionPlan['stages'][number][];
}

function segmentsFor(
  request:MusicVisualRequest,
  ratios:readonly MusicVisualAspectRatio[],
  sections:readonly SongSection[],
  timedLyrics:readonly TranscriptCue[],
  warnings:string[],
):MusicVisualSegment[] {
  if(request.deliverable==='teaser_pack'){
    const count=Math.max(1,Math.min(12,Math.floor(request.targetTeaserCount??6)));
    const candidates=teaserCandidates(request.source.audioDurationSeconds,sections,timedLyrics);
    if(!candidates.length)return [];
    const segments:MusicVisualSegment[]=[];
    for(let index=0;index<count;index+=1){
      const candidate=candidates[index%candidates.length]!;
      const ratio=ratios[index%ratios.length]??'9:16';
      segments.push(Object.freeze({
        id:request.id+':teaser:'+(index+1),
        role:'teaser',
        startSeconds:candidate.startSeconds,
        endSeconds:candidate.endSeconds,
        aspectRatio:ratio,
        lyricCueIds:Object.freeze(candidate.lyricCueIds),
        sectionIds:Object.freeze(candidate.sectionIds),
        intent:'Create a standalone short-form variation from verified song timing while preserving master-song continuity.',
      }));
    }
    return segments;
  }

  const primaryRatio=ratios[0]??'16:9';
  const role:MusicVisualSegment['role']=
    request.deliverable==='lyric_video'?'lyric-section':
    request.deliverable==='visualizer'?'visual':
    request.characterPerformanceRequested||request.lipSyncRequested?'performance':'master';
  if(request.deliverable==='music_video'&&request.source.audioDurationSeconds>300){
    warnings.push('DIRECTOR_MUSIC_VISUAL_LONG_MASTER_MAY_REQUIRE_SCENE_CHUNKING');
  }
  return [Object.freeze({
    id:request.id+':master',
    role,
    startSeconds:0,
    endSeconds:request.source.audioDurationSeconds,
    aspectRatio:primaryRatio,
    lyricCueIds:Object.freeze(timedLyrics.map((cue)=>cue.id)),
    sectionIds:Object.freeze(sections.map((section)=>section.id)),
    intent:request.deliverable==='lyric_video'
      ?'Render timed lyrics against the canonical master audio; typography and imagery may vary but text timing may not be invented.'
      :request.deliverable==='visualizer'
        ?'Create a coherent visual treatment synchronized to the canonical master audio.'
        :'Create a scene-based music video synchronized to the canonical master audio, preserving artist/style continuity.',
  })];
}

function teaserCandidates(
  duration:number,
  sections:readonly SongSection[],
  cues:readonly TranscriptCue[],
):Array<{startSeconds:number;endSeconds:number;sectionIds:string[];lyricCueIds:string[]}> {
  const candidates:Array<{startSeconds:number;endSeconds:number;sectionIds:string[];lyricCueIds:string[]}>=sections.map((section)=>{
    const start=section.startMs/1000;
    const end=Math.min(duration,section.endMs/1000,start+30);
    return {
      startSeconds:start,
      endSeconds:end,
      sectionIds:[section.id],
      lyricCueIds:cues.filter((cue)=>cue.startMs<end*1000&&cue.endMs>start*1000).map((cue)=>cue.id),
    };
  }).filter((item)=>item.endSeconds>item.startSeconds);

  if(!candidates.length){
    for(const cue of cues){
      const start=cue.startMs/1000;
      const end=Math.min(duration,Math.max(cue.endMs/1000,start+4),start+15);
      if(end>start)candidates.push({startSeconds:start,endSeconds:end,sectionIds:[],lyricCueIds:[cue.id]});
    }
  }
  return candidates;
}

function validTimedLyrics(
  cues:readonly TranscriptCue[],
  durationSeconds:number,
  blockers:string[],
):TranscriptCue[] {
  const valid:TranscriptCue[]=[];
  let previousEnd=-1;
  for(const cue of cues){
    const validRange=Number.isInteger(cue.startMs)&&Number.isInteger(cue.endMs)&&cue.startMs>=0&&cue.endMs>cue.startMs&&cue.endMs<=durationSeconds*1000;
    if(!cue.id.trim()||!cue.text.trim()||!validRange||cue.startMs<previousEnd){
      blockers.push('DIRECTOR_MUSIC_VISUAL_TIMED_LYRICS_INVALID');
      continue;
    }
    previousEnd=cue.endMs;
    valid.push(cue);
  }
  return valid;
}

function validSections(
  sections:readonly SongSection[],
  songId:string,
  warnings:string[],
):SongSection[] {
  const valid=sections.filter((section)=>
    section.songId===songId&&section.endMs>section.startMs&&section.startMs>=0&&section.functions.length>0,
  );
  if(sections.length!==valid.length)warnings.push('DIRECTOR_MUSIC_VISUAL_INVALID_SECTIONS_EXCLUDED');
  return valid;
}

function aspectRatios(request:MusicVisualRequest):MusicVisualAspectRatio[] {
  const supplied=unique(request.targetAspectRatios??[]);
  if(supplied.length)return supplied as MusicVisualAspectRatio[];
  if(request.deliverable==='teaser_pack')return ['9:16'];
  return ['16:9'];
}
function requireText(value:string,code:string):void{
  if(!value?.trim())throw new Error(code);
}
function unique<T extends string>(values:readonly T[]):T[]{
  return [...new Set(values.map((value)=>value.trim()).filter(Boolean) as T[])];
}
