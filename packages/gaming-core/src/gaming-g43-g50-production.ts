export interface GamingRouteObservation{gameId:string;runtimeId:string;deviceId:string;displayId:string;controllerProfileId:string;networkClass:'offline'|'lan'|'internet';compatible:boolean;measured:boolean;inputLatencyMs:number;frameTimeMs:number;crashed:boolean;saveRoundTripPassed:boolean;}
export interface GamingRouteChoice{runtimeId:string;score:number;reason:string;}
export class GamingRouteLearningLedger{
 private readonly rows:GamingRouteObservation[]=[];
 record(row:GamingRouteObservation){if(!row.measured)throw new Error('route observation must be measured');this.rows.push(Object.freeze({...row}));}
 best(gameId:string):GamingRouteChoice|undefined{return this.rows.filter(r=>r.gameId===gameId&&r.compatible&&!r.crashed&&r.saveRoundTripPassed).map(r=>({runtimeId:r.runtimeId,score:r.inputLatencyMs+r.frameTimeMs,reason:'measured-compatible-route'})).sort((a,b)=>a.score-b.score)[0];}
}
export interface AdaptiveVideoProfile{resolution:'2160p'|'1440p'|'1080p'|'720p';fps:120|60|30;bitrateMbps:number;}
export function adaptVideoPreservingInput(profile:AdaptiveVideoProfile,networkPressure:boolean,inputHealthy:boolean):AdaptiveVideoProfile{
 if(!networkPressure||!inputHealthy)return profile;
 const bitrate=Math.max(3,Math.floor(profile.bitrateMbps*.75));
 if(profile.resolution==='2160p')return{resolution:'1440p',fps:profile.fps,bitrateMbps:bitrate};
 if(profile.resolution==='1440p')return{resolution:'1080p',fps:profile.fps,bitrateMbps:bitrate};
 if(profile.resolution==='1080p')return{resolution:'720p',fps:profile.fps,bitrateMbps:bitrate};
 return{...profile,bitrateMbps:bitrate};
}
export interface SaveRevision{gameId:string;revision:number;digest:string;knownGood:boolean;createdAtMs:number;}
export class UniversalSaveVault{private readonly revisions=new Map<string,SaveRevision[]>();put(r:SaveRevision){const a=this.revisions.get(r.gameId)??[];if(a.some(x=>x.revision===r.revision&&x.digest!==r.digest))throw new Error('save revision conflict');this.revisions.set(r.gameId,[...a,Object.freeze({...r})]);}latestGood(gameId:string){return(this.revisions.get(gameId)??[]).filter(x=>x.knownGood).sort((a,b)=>b.revision-a.revision)[0];}}
export interface OneButtonPlayRequest{gameId:string;authorized:boolean;}
export function assertOneButtonPlayAuthorization(r:OneButtonPlayRequest){if(!r.authorized)throw new Error('Play requires authorization');}
export const G43_G50_PHASES=Object.freeze(['G43-compatibility','G44-stream-quality','G45-runtime-learning','G46-handoff','G47-save-fabric','G48-library-intelligence','G49-one-button-play','G50-software-freeze'] as const);
