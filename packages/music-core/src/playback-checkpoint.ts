export interface MusicPlaybackCheckpoint { userId:string; trackId:string; positionMs:number; updatedAt:string; completed:boolean; }
export interface MusicPlaybackCheckpointStore { get(userId:string,trackId:string):Promise<MusicPlaybackCheckpoint|null>; set(checkpoint:MusicPlaybackCheckpoint):Promise<void>; listRecent(userId:string,limit?:number):Promise<MusicPlaybackCheckpoint[]>; }
export function musicCheckpoint(userId:string,trackId:string,positionMs:number,durationMs?:number,now=new Date()):MusicPlaybackCheckpoint {
 if(!userId||!trackId) throw new Error("userId and trackId are required");
 const position=Math.max(0,Math.round(positionMs)); const completed=durationMs!=null&&durationMs>0&&position>=durationMs*0.95;
 return {userId,trackId,positionMs:position,updatedAt:now.toISOString(),completed};
}