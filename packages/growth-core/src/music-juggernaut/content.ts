import type {JuggernautMode,SongRecord,SongSection} from './domain.js';
import {assessCreativeDiversity,type CreativeDiversityAssessment} from './career.js';

export type MusicContentFamily =
  | 'mini_music_video'
  | 'location_performance'
  | 'performance_platform'
  | 'raw_performance'
  | 'story'
  | 'meme'
  | 'human_process'
  | 'live'
  | 'community'
  | 'weird_experiment';

export interface MusicCreativeBrief{
  id:string;
  songId:string;
  sectionId?:string;
  family:MusicContentFamily;
  objective:'discover'|'recognize'|'deepen'|'convert';
  productionBurden:'low'|'medium'|'high';
  capturePlan:string;
  hook:string;
  environment:string;
  evidenceRefs:readonly string[];
  authority:'CREATIVE_BRIEF_ONLY';
}

export interface MusicCreativePortfolio{
  songId:string;
  mode:JuggernautMode;
  briefs:readonly MusicCreativeBrief[];
  diversity:CreativeDiversityAssessment;
  doctrine:readonly string[];
}

const SEARCH_FAMILIES:readonly MusicContentFamily[]=[
  'mini_music_video','location_performance','performance_platform','raw_performance','story','meme','human_process','weird_experiment',
];
const ATTACK_FAMILIES:readonly MusicContentFamily[]=[
  'mini_music_video','location_performance','raw_performance','story','meme','community','live',
];

export function buildMusicCreativePortfolio(input:{
  song:SongRecord;
  mode:JuggernautMode;
  winningSectionId?:string;
  maxBriefs?:number;
}):MusicCreativePortfolio{
  if(!input.song.id.trim())throw new Error('MUSIC_JUGGERNAUT_SONG_REQUIRED');
  const max=Math.max(3,Math.min(24,input.maxBriefs??9));
  const sections=selectSections(input.song,input.mode,input.winningSectionId);
  const families=input.mode==='ATTACK'?ATTACK_FAMILIES:SEARCH_FAMILIES;
  const briefs:MusicCreativeBrief[]=[];
  let index=0;
  for(const family of families){
    if(briefs.length>=max)break;
    const section=sections[index%Math.max(1,sections.length)];
    briefs.push(buildBrief(input.song,family,section,index));
    index+=1;
  }
  const diversity=assessCreativeDiversity({variants:briefs.map((brief)=>({
    id:brief.id,family:brief.family,hook:brief.hook,environment:brief.environment,sectionId:brief.sectionId,
  }))});
  return Object.freeze({
    songId:input.song.id,
    mode:input.mode,
    briefs:Object.freeze(briefs),
    diversity,
    doctrine:Object.freeze(input.mode==='SEARCH'?[
      'Explore genuinely different concepts and song sections before spending for polish.',
      'The lowest production burden that preserves idea quality wins the first test.',
      'Do not confuse file count with concept diversity.',
      'Keep one weird but authentic experiment in the portfolio.',
    ]:[
      'Concentrate on the validated song section while varying the wrapper.',
      'Feed the winner without making every post visually identical.',
      'Prepare the follow-up and direct-fan capture at the same time.',
      'Paid amplification remains separate and approval-bound.',
    ]),
  });
}

export function defaultMusicContentSpine():readonly {family:MusicContentFamily;purpose:string}[]{
  return Object.freeze([
    {family:'mini_music_video',purpose:'Reusable 30–45 second visual concepts; recycle strong unused treatment ideas.'},
    {family:'location_performance',purpose:'Low-friction one-camera performances in environments that make the song feel inevitable.'},
    {family:'performance_platform',purpose:'Borrow production quality, audience, and proof from legitimate third-party performance platforms.'},
  ]);
}

function selectSections(song:SongRecord,mode:JuggernautMode,winningSectionId?:string):SongSection[]{
  if(mode==='ATTACK'){
    if(!winningSectionId)throw new Error('MUSIC_JUGGERNAUT_ATTACK_SECTION_REQUIRED');
    const winning=song.sections.find((section)=>section.id===winningSectionId);
    if(!winning)throw new Error('MUSIC_JUGGERNAUT_ATTACK_SECTION_UNKNOWN');
    return [winning];
  }
  return song.sections.length?[...song.sections]:[];
}

function buildBrief(song:SongRecord,family:MusicContentFamily,section:SongSection|undefined,index:number):MusicCreativeBrief{
  const sectionLabel=section?.label??'best available moment';
  const recipes:Record<MusicContentFamily,{objective:MusicCreativeBrief['objective'];burden:MusicCreativeBrief['productionBurden'];capture:string;hook:string;environment:string}>={
    mini_music_video:{objective:'discover',burden:'medium',capture:'Shoot one contained narrative/visual idea that can stand alone in under 45 seconds.',hook:'Open on the strongest visual question, then let '+sectionLabel+' pay it off.',environment:'story-specific set or practical location'},
    location_performance:{objective:'discover',burden:'low',capture:'Perform a full take in a visually coherent location so multiple sections can be cut later.',hook:'Make the environment explain how the song feels before the caption does.',environment:'context-matched real location'},
    performance_platform:{objective:'recognize',burden:'medium',capture:'Use a legitimate session/open-mic/performance platform and retain reusable footage rights.',hook:'Lead with undeniable performance proof.',environment:'third-party performance set'},
    raw_performance:{objective:'discover',burden:'low',capture:'Phone/tripod full take with expressive performance and minimal setup.',hook:'Start at the lyric or movement that earns the first second.',environment:'daily-life environment'},
    story:{objective:'deepen',burden:'low',capture:'Tell one true story or premise that makes the song more meaningful.',hook:'State the tension before explaining the song.',environment:'direct-to-camera'},
    meme:{objective:'discover',burden:'low',capture:'Score a genuinely relatable situation with the song; the joke must work even before promotion is obvious.',hook:'Use the human situation as the doorway, not “stream my song.”',environment:'native social context'},
    human_process:{objective:'deepen',burden:'low',capture:'Show a real artifact, rejected version, rehearsal, note, studio mistake, or work-in-progress.',hook:'Evidence of life before polish.',environment:'actual process space'},
    live:{objective:'deepen',burden:'medium',capture:'Capture the crowd moment, transition, ritual, and strongest performance section.',hook:'Let real audience response provide the proof.',environment:'live room'},
    community:{objective:'convert',burden:'low',capture:'Build around real fan language, replies, UGC, or a recurring ritual with permission.',hook:'Reflect the audience back to itself without manufacturing support.',environment:'fan/community surface'},
    weird_experiment:{objective:'discover',burden:'low',capture:'Try one memorable idea that feels authentically strange enough to create a visual question.',hook:'Make the first frame impossible to confuse with ordinary music promo.',environment:'unexpected but permissioned setting'},
  };
  const recipe=recipes[family];
  return Object.freeze({
    id:'music-creative:'+song.id+':'+family+':'+(section?.id??index),
    songId:song.id,
    sectionId:section?.id,
    family,
    objective:recipe.objective,
    productionBurden:recipe.burden,
    capturePlan:recipe.capture,
    hook:recipe.hook,
    environment:recipe.environment,
    evidenceRefs:Object.freeze([...new Set(song.evidenceRefs)]),
    authority:'CREATIVE_BRIEF_ONLY',
  });
}
