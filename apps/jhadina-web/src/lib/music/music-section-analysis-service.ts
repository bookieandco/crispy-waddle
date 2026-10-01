import type {SupabaseClient} from '@supabase/supabase-js';
import {analyzeRestorationArtifact} from './restoration-analysis-service';
import {createMusicJuggernautRepository,type MusicJuggernautRepository} from './music-juggernaut-repository';

type Row=Record<string,unknown>;

export interface SongSectionAnalysisReceipt {
  projectId:string;
  songId:string;
  artifactId:string;
  caseId:string;
  runtimeReceiptId:string;
  sampleRate:number;
  sectionCount:number;
  sections:readonly {
    id:string;
    songId:string;
    startMs:number;
    endMs:number;
    label:string;
    functions:readonly ['structure'];
    confidence:number;
    evidenceRefs:readonly string[];
  }[];
  source:'music-restoration-librosa';
  externalActionsStarted:false;
}

export async function analyzeSongSectionsFromRestoration(input:{
  client:SupabaseClient;
  ownerUserId:string;
  projectId:string;
  songId:string;
  caseId:string;
  artifactId:string;
  repository?:MusicJuggernautRepository;
}):Promise<SongSectionAnalysisReceipt>{
  const repository=input.repository??createMusicJuggernautRepository();
  const songs=await repository.listSongs(input.ownerUserId,input.projectId);
  const song=songs.find((row)=>String(row.id)===input.songId);
  if(!song)throw new Error('MUSIC_SECTION_ANALYSIS_SONG_NOT_FOUND');

  const analysis=await analyzeRestorationArtifact({
    client:input.client,
    ownerUserId:input.ownerUserId,
    caseId:input.caseId,
    artifactId:input.artifactId,
    separate:false,
  });
  const sampleRate=analysis.source.sampleRate;
  if(!Number.isFinite(sampleRate)||sampleRate<=0)throw new Error('MUSIC_SECTION_ANALYSIS_SAMPLE_RATE_INVALID');

  const sections=analysis.source.sections.flatMap((section,index)=>{
    if(section.endSample<=section.startSample)return [];
    const startMs=Math.round((section.startSample/sampleRate)*1000);
    const endMs=Math.round((section.endSample/sampleRate)*1000);
    if(endMs<=startMs)return [];
    return [Object.freeze({
      id:'perception:'+input.songId+':'+String(index+1),
      songId:input.songId,
      startMs,
      endMs,
      label:section.label?.trim()||('Structure '+String(index+1)),
      functions:Object.freeze(['structure'] as const),
      confidence:clamp(section.confidence),
      evidenceRefs:Object.freeze([
        'music-perception:'+analysis.source.runtimeReceiptId,
        ...section.evidenceIds,
      ]),
    })];
  });
  if(!sections.length)throw new Error('MUSIC_SECTION_ANALYSIS_NO_SECTIONS');

  const existingSections=Array.isArray(song.sections)?song.sections:[];
  const preservedManual=existingSections.filter((raw)=>{
    if(!raw||typeof raw!=='object')return true;
    const row=raw as Row;
    return typeof row.source!=='string'||row.source!=='music-restoration-librosa';
  });
  const persistedSections=[
    ...preservedManual,
    ...sections.map((section)=>({
      id:section.id,
      songId:section.songId,
      startMs:section.startMs,
      endMs:section.endMs,
      label:section.label,
      functions:[...section.functions],
      confidence:section.confidence,
      source:'music-restoration-librosa',
      runtimeReceiptId:analysis.source.runtimeReceiptId,
      evidenceRefs:[...section.evidenceRefs],
    })),
  ];

  await repository.upsertSong({
    projectId:input.projectId,
    songKey:String(song.song_key),
    title:String(song.title??song.song_key),
    releaseStatus:String(song.release_status??'catalog'),
    campaignState:String(song.campaign_state??'INGESTED'),
    artistConviction:rate(song.artist_conviction,0.5),
    rightsState:String(song.rights_state??'review_required'),
    sections:persistedSections,
    evidenceRefs:unique([
      ...stringArray(song.evidence_refs),
      'music-perception:'+analysis.source.runtimeReceiptId,
    ]),
    releaseDate:optionalString(song.release_date),
  });

  return Object.freeze({
    projectId:input.projectId,
    songId:input.songId,
    artifactId:input.artifactId,
    caseId:input.caseId,
    runtimeReceiptId:analysis.source.runtimeReceiptId,
    sampleRate,
    sectionCount:sections.length,
    sections:Object.freeze(sections),
    source:'music-restoration-librosa',
    externalActionsStarted:false,
  });
}

function clamp(value:number):number{return Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;}
function rate(value:unknown,fallback:number):number{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;}
function stringArray(value:unknown):string[]{return Array.isArray(value)?value.map(String).filter(Boolean):[];}
function optionalString(value:unknown):string|undefined{return typeof value==='string'&&value.trim()?value:undefined;}
function unique(values:readonly string[]):string[]{return [...new Set(values.map((value)=>value.trim()).filter(Boolean))];}
