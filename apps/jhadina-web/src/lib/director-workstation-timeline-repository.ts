import type {SupabaseClient} from '@supabase/supabase-js';
import type {EditableTimeline} from '@jhadina/director-core/timeline-model';

type SnapshotRow={
  id:string;
  project_id:string;
  owner_user_id:string;
  version:number;
  parent_id:string|null;
  timeline:EditableTimeline;
  evidence_ids:string[]|null;
  created_at:string;
};

export type DirectorTimelineSnapshot={
  id:string;
  projectId:string;
  ownerUserId:string;
  version:number;
  parentId?:string;
  timeline:EditableTimeline;
  evidenceIds:string[];
  createdAt:string;
};

function hydrate(row:SnapshotRow):DirectorTimelineSnapshot{
  if(row.timeline.projectId!==row.project_id) throw new Error('DIRECTOR_TIMELINE_PROJECT_MISMATCH');
  return {
    id:row.id,
    projectId:row.project_id,
    ownerUserId:row.owner_user_id,
    version:Number(row.version),
    ...(row.parent_id?{parentId:row.parent_id}:{}),
    timeline:row.timeline,
    evidenceIds:Array.isArray(row.evidence_ids)?row.evidence_ids.map(String):[],
    createdAt:row.created_at,
  };
}

export function createDefaultDirectorTimeline(projectId:string):EditableTimeline{
  return {
    version:1,
    projectId,
    fps:30,
    width:1920,
    height:1080,
    durationSeconds:30,
    playheadSeconds:0,
    tracks:[
      {id:'video-1',name:'Video',kind:'video',index:0,clips:[]},
      {id:'audio-1',name:'Audio',kind:'audio',index:1,clips:[]},
    ],
    transitions:[],
    markers:[],
    versions:[],
  };
}

export class DirectorWorkstationTimelineRepository{
  constructor(private readonly client:SupabaseClient){}

  async latest(projectId:string):Promise<DirectorTimelineSnapshot|undefined>{
    const {data,error}=await this.client
      .from('director_editable_timeline_snapshots')
      .select('id,project_id,owner_user_id,version,parent_id,timeline,evidence_ids,created_at')
      .eq('project_id',projectId)
      .order('version',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(error) throw new Error(`DIRECTOR_TIMELINE_READ_FAILED:${error.message}`);
    return data?hydrate(data as SnapshotRow):undefined;
  }

  async persist(input:{
    projectId:string;
    userId:string;
    expectedVersion:number;
    timeline:EditableTimeline;
    evidenceIds?:readonly string[];
    snapshotId?:string;
  }):Promise<DirectorTimelineSnapshot>{
    if(input.timeline.projectId!==input.projectId) throw new Error('DIRECTOR_TIMELINE_PROJECT_MISMATCH');
    const {data,error}=await this.client.rpc('persist_director_editable_timeline_snapshot',{
      p_snapshot_id:input.snapshotId??`timeline:${input.projectId}:${crypto.randomUUID()}`,
      p_project_id:input.projectId,
      p_user_id:input.userId,
      p_expected_version:input.expectedVersion,
      p_timeline:input.timeline,
      p_evidence_ids:[...(input.evidenceIds??[])],
      p_now:new Date().toISOString(),
    });
    if(error) throw new Error(`DIRECTOR_TIMELINE_WRITE_FAILED:${error.message}`);
    return hydrate(data as SnapshotRow);
  }

  async ensure(projectId:string,userId:string):Promise<DirectorTimelineSnapshot>{
    const existing=await this.latest(projectId);
    if(existing) return existing;
    try{
      return await this.persist({
        projectId,
        userId,
        expectedVersion:0,
        timeline:createDefaultDirectorTimeline(projectId),
        evidenceIds:['DIRECTOR_WORKSTATION_INITIAL_TIMELINE'],
      });
    }catch(error){
      if(error instanceof Error&&error.message.includes('DIRECTOR_TIMELINE_VERSION_CONFLICT')){
        const raced=await this.latest(projectId);
        if(raced) return raced;
      }
      throw error;
    }
  }
}
