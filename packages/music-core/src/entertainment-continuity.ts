export type EntertainmentMediaRef={domain:"music"|"tv";mediaId:string};
export type EntertainmentResumePoint={ref:EntertainmentMediaRef;positionMs:number;updatedAt:string;completed:boolean};
export interface EntertainmentContinuityPort { recent(userId:string,limit?:number):Promise<EntertainmentResumePoint[]>; resume(userId:string,ref:EntertainmentMediaRef):Promise<EntertainmentResumePoint|null>; }
