import type {SupabaseClient} from '@supabase/supabase-js';
import type {SongSection} from '@jhadina/growth-core';
import {createMusicJuggernautRepository,type MusicJuggernautRepository} from './music-juggernaut-repository';
import {runPersistedPerception,type PersistedPerceptionSummary} from './restoration-perception-service';
import {SupabaseMusicRestorationArtifactStore} from './restoration-supabase-store';

type Row=Record<string,unknown>;

export interface PerceivedJuggernautSection extends SongSection {
  sourceArtifactId:string;
  runtimeReceiptId:string;
  confidence:number;
  evidenceRefs:readonly string[];
}

export interface MusicSectionPerceptionReceipt {
  artistKey:string;
  projectId:string;
  songId:string;
  songKey:string;
  sourceArtifactId:string;
  restorationCaseId:string;
  runtimeReceiptId:string;
  measuredSectionCount:number;
  admittedSectionCount:number;
  preservedManualSectionCount:number;
  evidenceRefs:readonly string[];
  externalActionsStarted:false;
}

export function buildJuggernautSectionsFromPerception(input:{
  songId:string;
  artifactId:string;
  perception:PersistedPerceptionSummary;
  minimumConfidence?:number;
}):readonly PerceivedJuggernautSection[] {
  const minimumConfidence=Math.max(0,Math.min(1,input.minimumConfidence??0.5));
  if(!Number.isFinite(input.perception.sampleRate)||input.perception.sampleRate<=0)return Object.freeze([]);
  const sections:PerceivedJuggernautSection[]=[];
  for(const [index,section] of input.perception.sections.entries()){
    if(
      section.endSample<=section.startSample
      || !Number.isFinite(section.confidence)
      || section.confidence<minimumConfidence
    )continue;
    const startMs=Math.round(section.startSample/input.perception.sampleRate*1000);
    const endMs=Math.round(section.endSample/input.perception.sampleRate*1000);
    if(endMs<=startMs)continue;
    sections.push(Object.freeze({
      id:'section:perception:'+input.artifactId+':'+section.startSample,
      songId:input.songId,
      startMs,
      endMs,
      label:section.label?.trim()||('Measured section '+(index+1)),
      functions:Object.freeze(['structure']) as SongSection['functions'],
      sourceArtifactId:input.artifactId,
      runtimeReceiptId:input.perception.runtimeReceiptId,
      confidence:section.confidence,
      evidenceRefs:Object.freeze(unique([
        ...section.evidenceIds,
        'music-restoration-artifact:'+input.artifactId,
        'music-perception-receipt:'+input.perception.runtimeReceiptId,
      ])),
    }));
  }
  return Object.freeze(sections);
}

export async function perceiveSongSectionsIntoJuggernaut(input:{
  client:SupabaseClient;
  userId:string;
  artistKey:string;
  songId:string;
  caseId:string;
  artifactId:string;
  minimumConfidence?:number;
},overrides:{
  repository?:MusicJuggernautRepository;
  perceive?:typeof runPersistedPerception;
}={}):Promise<MusicSectionPerceptionReceipt> {
  const repository=overrides.repository??createMusicJuggernautRepository();
  const project=await repository.getProject(input.userId,input.artistKey);
  if(!project)throw new Error('MUSIC_SECTION_PERCEPTION_PROJECT_NOT_FOUND');
  const projectId=String(project.id);
  const songs=await repository.listSongs(input.userId,projectId);
  const song=songs.find((row)=>String(row.id)===input.songId);
  if(!song)throw new Error('MUSIC_SECTION_PERCEPTION_SONG_NOT_FOUND');

  const store=new SupabaseMusicRestorationArtifactStore(input.client,input.userId);
  const artifact=await store.get(input.userId,input.artifactId);
  if(!artifact||artifact.caseId!==input.caseId){
    throw new Error('MUSIC_SECTION_PERCEPTION_ARTIFACT_NOT_FOUND');
  }

  const perceive=overrides.perceive??runPersistedPerception;
  const perception=await perceive({
    client:input.client,
    ownerUserId:input.userId,
    caseId:input.caseId,
    artifact,
  });
  const admitted=buildJuggernautSectionsFromPerception({
    songId:input.songId,
    artifactId:input.artifactId,
    perception,
    minimumConfidence:input.minimumConfidence,
  });
  if(!admitted.length)throw new Error('MUSIC_SECTION_PERCEPTION_NO_ADMITTED_SECTIONS');

  const existingSections=Array.isArray(song.sections)
    ?song.sections.filter((raw)=>{
      if(!raw||typeof raw!=='object')return false;
      const row=raw as Row;
      return String(row.sourceArtifactId??row.source_artifact_id??'')!==input.artifactId
        && !String(row.id??'').startsWith('section:perception:'+input.artifactId+':');
    })
    :[];
  const evidenceRefs=unique([
    ...stringArray(song.evidence_refs),
    ...admitted.flatMap((section)=>section.evidenceRefs),
  ]);

  await repository.upsertSong({
    projectId,
    songKey:String(song.song_key),
    title:String(song.title??song.song_key),
    releaseStatus:String(song.release_status??'catalog'),
    campaignState:String(song.campaign_state??'INGESTED'),
    artistConviction:rate(song.artist_conviction,0.5),
    rightsState:String(song.rights_state??'review_required'),
    sections:[...existingSections,...admitted],
    evidenceRefs,
    releaseDate:typeof song.release_date==='string'?song.release_date:undefined,
  });

  return Object.freeze({
    artistKey:input.artistKey,
    projectId,
    songId:input.songId,
    songKey:String(song.song_key),
    sourceArtifactId:input.artifactId,
    restorationCaseId:input.caseId,
    runtimeReceiptId:perception.runtimeReceiptId,
    measuredSectionCount:perception.sections.length,
    admittedSectionCount:admitted.length,
    preservedManualSectionCount:existingSections.length,
    evidenceRefs:Object.freeze(evidenceRefs),
    externalActionsStarted:false,
  });
}

function rate(value:unknown,fallback:number):number{
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;
}
function stringArray(value:unknown):string[]{
  return Array.isArray(value)?value.map(String).filter(Boolean):[];
}
function unique(values:readonly string[]):string[]{
  return [...new Set(values.map((value)=>value.trim()).filter(Boolean))];
}
