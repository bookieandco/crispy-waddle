import {
  buildMusicCreativePortfolio,\n  certifyMusicJuggernautCore,
  chooseJuggernautMode,
  detectCreativeOutlier,
  rankSongs,
  recommendVenueCapacity,
  type ContentExperiment,
  type CreativeOutlier,
  type PerformanceObservation,
  type SongRecord,
  type SongSection,\n  type MusicCreativePortfolio,
} from '@jhadina/growth-core';
import {createMusicJuggernautRepository,type MusicJuggernautRepository} from './music-juggernaut-repository';\nimport {loadMusicFanAudienceProjection,type MusicFanAudienceProjection} from './music-fan-projection';

type Row=Record<string,unknown>;

export interface MusicJuggernautProjection{
  project:Row;
  songs:Row[];
  experiments:Row[];
  observations:Row[];
  cityDemand:Row[];
  rights:Row[];
  learning:Row[];
  outliers:CreativeOutlier[];
  mode:'SEARCH'|'ATTACK';
  rankedSongs:SongRecord[];
  venues:ReturnType<typeof recommendVenueCapacity>[];
  certification:ReturnType<typeof certifyMusicJuggernautCore>;
  dataWarnings:string[];
}

export async function ensureMusicJuggernautProject(input:{
  userId:string;
  artistKey:string;
  artistName:string;
  repository?:MusicJuggernautRepository;
}):Promise<Row>{
  const repository=input.repository??createMusicJuggernautRepository();
  const existing=await repository.getProject(input.userId,input.artistKey);
  if(existing)return existing;
  return repository.upsertProject({
    artistKey:input.artistKey,
    name:input.artistName,
    mode:'SEARCH',
    metadata:{createdBy:'music-juggernaut',authority:'INTERNAL_PLANNING_ONLY',brandId:input.artistKey==='atwood-bookie'?'brand:atwood-bookie':undefined},
  });
}

export async function loadMusicJuggernautProjection(input:{
  userId:string;
  artistKey:string;
  initialize?:boolean;
  artistName?:string;
  repository?:MusicJuggernautRepository;
}):Promise<MusicJuggernautProjection|null>{
  const repository=input.repository??createMusicJuggernautRepository();
  let project=await repository.getProject(input.userId,input.artistKey);
  if(!project&&input.initialize){
    project=await ensureMusicJuggernautProject({
      userId:input.userId,
      artistKey:input.artistKey,
      artistName:input.artistName??input.artistKey,
      repository,
    });
  }
  if(!project)return null;
  const projectId=String(project.id);
  const [songs,experiments,observations,cityDemand,rights,learning]=await Promise.all([
    repository.listSongs(input.userId,projectId),
    repository.listExperiments(input.userId,projectId),
    repository.listObservations(input.userId,projectId),
    repository.listCityDemand(input.userId,projectId),
    repository.listRights(input.userId,projectId),
    repository.listLearning(input.userId,projectId),
  ]);
  const dataWarnings:string[]=[];
  const experimentModels=experiments.map(mapExperiment);
  const experimentByDb=new Map(experiments.map((row,index)=>[String(row.id),experimentModels[index]!]));
  const observationModels:PerformanceObservation[]=[];
  const outliers:CreativeOutlier[]=[];
  const baseline={
    medianViews:Math.max(1,median(observations.map((row)=>numberValue(row.views)))),
    medianSongActions:Math.max(1,median(observations.map((row)=>numberValue(row.song_actions)))),
    medianDirectFanCaptures:Math.max(1,median(observations.map((row)=>numberValue(row.direct_fan_captures)))),
    minimumExposures:100,
  };
  for(const row of observations){
    const experiment=experimentByDb.get(String(row.experiment_id));
    if(!experiment){
      dataWarnings.push('Observation '+String(row.id)+' has no matching experiment.');
      continue;
    }
    const observation=mapObservation(row,experiment.id);
    observationModels.push(observation);
    try{outliers.push(detectCreativeOutlier(observation,baseline));}
    catch(error){dataWarnings.push('Observation '+String(row.id)+' was excluded from outlier scoring: '+message(error));}
  }
  const songModels=songs.map(mapSong);
  const rankedSongs=[...rankSongs(songModels,observationModels,experimentModels)];
  const venues=cityDemand.flatMap((row)=>{
    try{
      return [recommendVenueCapacity({
        city:String(row.city_name??''),
        listeners:numberValue(row.listeners),
        directFans:numberValue(row.direct_fans),
        showInterest:numberValue(row.show_interest),
        priorAttendees:numberValue(row.prior_attendees),
        repeatFans:numberValue(row.repeat_fans),
        evidenceRefs:evidence(row,'music-city-demand'),
      })];
    }catch(error){
      dataWarnings.push('City demand '+String(row.id)+' could not be projected: '+message(error));
      return [];
    }
  });
  const mode=chooseJuggernautMode({outliers});
  return {
    project,songs,experiments,observations,cityDemand,rights,learning,outliers,mode,rankedSongs,venues,
    certification:certifyMusicJuggernautCore(),
    dataWarnings,
  };
}

function mapSong(row:Row):SongRecord{
  return {
    id:String(row.id),
    title:String(row.title??row.song_key??'Untitled'),
    status:row.release_status==='released'||row.release_status==='catalog'?row.release_status:'unreleased',
    artistConviction:rate(row.artist_conviction,0.5),
    sections:parseSections(row.sections,String(row.id)),
    rightsState:row.rights_state==='clear'||row.rights_state==='blocked'?row.rights_state:'review_required',
    releaseDate:typeof row.release_date==='string'?row.release_date:undefined,
    evidenceRefs:evidence(row,'music-song'),
  };
}

function parseSections(value:unknown,songId:string):SongSection[]{
  if(!Array.isArray(value))return [];
  return value.flatMap((raw,index)=>{
    if(!raw||typeof raw!=='object')return [];
    const row=raw as Row;
    const startMs=numberValue(row.startMs??row.start_ms);
    const endMs=numberValue(row.endMs??row.end_ms);
    if(endMs<=startMs)return [];
    const allowed=new Set(['lyric','melody','emotion','meme','performance','loop']);
    const functions=Array.isArray(row.functions)
      ?row.functions.map(String).filter((item)=>allowed.has(item)) as SongSection['functions'][number][]
      :[];
    if(!functions.length)return [];
    return [{
      id:String(row.id??('section:'+songId+':'+index)),
      songId,
      startMs,endMs,
      label:String(row.label??('Section '+(index+1))),
      functions,
    }];
  });
}

function mapExperiment(row:Row):ContentExperiment{
  return {
    id:String(row.experiment_key??row.id),
    songId:String(row.song_id),
    sectionId:typeof row.section_key==='string'&&row.section_key?row.section_key:undefined,
    hypothesis:String(row.hypothesis??''),
    contentFamily:String(row.content_family??''),
    platform:String(row.platform??''),
    audience:typeof row.audience==='string'&&row.audience?row.audience:undefined,
    spendMinor:numberValue(row.spend_minor),
    currency:String(row.currency??'USD'),
    sampleTarget:numberValue(row.sample_target),
    successSignal:String(row.success_signal??''),
    failureSignal:String(row.failure_signal??''),
    status:row.status==='running'||row.status==='complete'||row.status==='stopped'?row.status:'planned',
    evidenceRefs:evidence(row,'music-experiment'),
  };
}

function mapObservation(row:Row,experimentId:string):PerformanceObservation{
  return {
    id:String(row.id),experimentId,
    exposures:numberValue(row.exposures),views:numberValue(row.views),
    engagedViews:nullableNumber(row.engaged_views),
    shares:numberValue(row.shares),saves:numberValue(row.saves),comments:numberValue(row.comments),
    profileVisits:numberValue(row.profile_visits),songActions:numberValue(row.song_actions),
    directFanCaptures:numberValue(row.direct_fan_captures),purchases:nullableNumber(row.purchases),
    revenueMinor:nullableNumber(row.revenue_minor),botRisk:rate(row.bot_risk,0),
    attributionConfidence:rate(row.attribution_confidence,0.5),
    observedAt:String(row.observed_at??row.created_at??new Date(0).toISOString()),
    evidenceRefs:evidence(row,'music-observation'),
  };
}

function evidence(row:Row,prefix:string):string[]{
  const refs=Array.isArray(row.evidence_refs)?row.evidence_refs.map(String).filter(Boolean):[];
  return refs.length?refs:[prefix+':'+String(row.id??'unknown')];
}
function rate(value:unknown,fallback:number):number{const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;}
function numberValue(value:unknown):number{const n=Number(value);return Number.isFinite(n)&&n>=0?n:0;}
function nullableNumber(value:unknown):number|undefined{if(value===null||value===undefined)return undefined;return numberValue(value);}
function median(values:number[]):number{if(!values.length)return 0;const s=[...values].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]??0:((s[m-1]??0)+(s[m]??0))/2;}
function message(error:unknown):string{return error instanceof Error?error.message:String(error);}
