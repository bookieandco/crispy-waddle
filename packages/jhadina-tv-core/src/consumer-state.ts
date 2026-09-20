export interface TVPlaybackCheckpoint { userId:string; mediaId:string; seriesId?:string; seasonId?:string; positionSeconds:number; durationSeconds?:number; updatedAt:string; completed:boolean; }
export interface TVWatchlistEntry { userId:string; mediaId:string; addedAt:string; }
export interface TVConsumerStateStore { getCheckpoint(userId:string,mediaId:string):Promise<TVPlaybackCheckpoint|null>; setCheckpoint(value:TVPlaybackCheckpoint):Promise<void>; listContinueWatching(userId:string,limit?:number):Promise<TVPlaybackCheckpoint[]>; setWatchlisted(userId:string,mediaId:string,watchlisted:boolean):Promise<void>; listWatchlist(userId:string):Promise<TVWatchlistEntry[]>; }
export function tvCheckpoint(input:Omit<TVPlaybackCheckpoint,"completed"|"updatedAt">,now=new Date()):TVPlaybackCheckpoint {
 if(!input.userId||!input.mediaId) throw new Error("userId and canonical mediaId are required");
 const positionSeconds=Math.max(0,input.positionSeconds); const completed=input.durationSeconds!=null&&input.durationSeconds>0&&positionSeconds>=input.durationSeconds*0.95;
 return {...input,positionSeconds,completed,updatedAt:now.toISOString()};
}