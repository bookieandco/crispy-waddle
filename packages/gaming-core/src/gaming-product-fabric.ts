import type {GameLibraryEntry} from './game-library.js';

export interface GamingLibraryCard {
  gameId:string;
  title:string;
  platform:string;
  installed:boolean;
  runtimeIds:readonly string[];
  hasSave:boolean;
  achievementReadAvailable:boolean;
  recentSessionAtMs?:number;
}

export interface GamingLibraryProjectionInput {
  game:GameLibraryEntry;
  runtimeIds:readonly string[];
  hasSave:boolean;
  achievementReadAvailable:boolean;
  recentSessionAtMs?:number;
}

export function projectGamingLibraryCard(input:GamingLibraryProjectionInput):GamingLibraryCard{
  return{
    gameId:input.game.id,
    title:input.game.title,
    platform:input.game.platform,
    installed:input.game.installed??false,
    runtimeIds:[...input.runtimeIds],
    hasSave:input.hasSave,
    achievementReadAvailable:input.achievementReadAvailable,
    recentSessionAtMs:input.recentSessionAtMs,
  };
}

export type GamingExecutionLocation='phone'|'browser'|'homebase'|'desktop'|'playstation'|'xbox';
export type GamingDisplayTarget='phone'|'tv'|'browser'|'local-display';

export interface GamingRuntimePathCandidate {
  id:string;
  runtimeId:string;
  execution:GamingExecutionLocation;
  display:GamingDisplayTarget;
  available:boolean;
  direct:boolean;
  offline:boolean;
  hops:number;
  networkLatencyMs:number;
  inputLatencyMs:number;
  measured:boolean;
}

export interface GamingRuntimePathPolicy {
  maxNetworkLatencyMs:number;
  maxInputLatencyMs:number;
  requireMeasured:boolean;
  preferOffline:boolean;
  preferDirect:boolean;
}

export interface GamingRuntimePathDecision {
  selected:GamingRuntimePathCandidate;
  rejected:readonly {id:string;reason:string}[];
}

export function selectGamingRuntimePath(
  candidates:readonly GamingRuntimePathCandidate[],
  policy:GamingRuntimePathPolicy,
):GamingRuntimePathDecision{
  const rejected:{id:string;reason:string}[]=[];
  const viable=candidates.filter(candidate=>{
    let reason='';
    if(!candidate.available)reason='unavailable';
    else if(policy.requireMeasured&&!candidate.measured)reason='unmeasured';
    else if(candidate.networkLatencyMs>policy.maxNetworkLatencyMs)reason='network-latency';
    else if(candidate.inputLatencyMs>policy.maxInputLatencyMs)reason='input-latency';
    if(reason){rejected.push({id:candidate.id,reason});return false;}
    return true;
  });
  if(viable.length===0)throw new Error('No viable gaming runtime path');
  const selected=[...viable].sort((a,b)=>{
    const aPenalty=(policy.preferDirect&&!a.direct?1000:0)+(policy.preferOffline&&!a.offline?500:0)+(a.hops*100)+a.networkLatencyMs+a.inputLatencyMs;
    const bPenalty=(policy.preferDirect&&!b.direct?1000:0)+(policy.preferOffline&&!b.offline?500:0)+(b.hops*100)+b.networkLatencyMs+b.inputLatencyMs;
    return aPenalty-bPenalty||a.id.localeCompare(b.id);
  })[0]!;
  return{selected,rejected};
}

export interface GamingResumePointer {
  gameId:string;
  runtimeId:string;
  saveId?:string;
  destination?:GamingDisplayTarget;
  controllerProfileId?:string;
}

export class GamingResumeRegistry {
  private readonly pointers=new Map<string,GamingResumePointer>();
  save(pointer:GamingResumePointer):void{this.pointers.set(pointer.gameId,Object.freeze({...pointer}));}
  get(gameId:string):GamingResumePointer|undefined{
    const pointer=this.pointers.get(gameId);
    return pointer?{...pointer}:undefined;
  }
}
