import {describe,expect,it,vi} from 'vitest';
import {
  createDefaultDirectorTimeline,
  DirectorWorkstationTimelineRepository,
} from './director-workstation-timeline-repository';

function clientWith(options:{
  latest?:Record<string,unknown>|null;
  rpcData?:Record<string,unknown>;
  rpcError?:{message:string}|null;
}={}){
  const maybeSingle=vi.fn(async()=>({data:options.latest??null,error:null}));
  const query:any={
    select:()=>query,
    eq:()=>query,
    order:()=>query,
    limit:()=>query,
    maybeSingle,
  };
  const rpc=vi.fn(async()=>({
    data:options.rpcData??null,
    error:options.rpcError??null,
  }));
  return {
    client:{from:vi.fn(()=>query),rpc} as any,
    rpc,
    maybeSingle,
  };
}

describe('Director Workstation timeline repository',()=>{
  it('creates an empty canonical NLE baseline without fake demo media',()=>{
    const timeline=createDefaultDirectorTimeline('director:user:default');
    expect(timeline.projectId).toBe('director:user:default');
    expect(timeline.tracks).toHaveLength(2);
    expect(timeline.tracks.flatMap(track=>track.clips)).toEqual([]);
    expect(timeline.versions).toEqual([]);
  });

  it('persists with expected-version fencing and authenticated actor identity',async()=>{
    const timeline=createDefaultDirectorTimeline('project-a');
    const row={
      id:'timeline:project-a:2',
      project_id:'project-a',
      owner_user_id:'owner-a',
      version:2,
      parent_id:'timeline:project-a:1',
      timeline,
      evidence_ids:['DIRECTOR_TIMELINE_COMMAND:move'],
      created_at:'2026-10-03T17:30:00.000Z',
    };
    const mock=clientWith({rpcData:row});
    const repository=new DirectorWorkstationTimelineRepository(mock.client);
    const saved=await repository.persist({
      projectId:'project-a',
      userId:'user-a',
      expectedVersion:1,
      timeline,
      evidenceIds:['DIRECTOR_TIMELINE_COMMAND:move'],
      snapshotId:'timeline:project-a:2',
    });

    expect(mock.rpc).toHaveBeenCalledWith(
      'persist_director_editable_timeline_snapshot',
      expect.objectContaining({
        p_snapshot_id:'timeline:project-a:2',
        p_project_id:'project-a',
        p_user_id:'user-a',
        p_expected_version:1,
        p_timeline:timeline,
        p_evidence_ids:['DIRECTOR_TIMELINE_COMMAND:move'],
      }),
    );
    expect(saved.version).toBe(2);
    expect(saved.parentId).toBe('timeline:project-a:1');
  });

  it('fails closed instead of treating a write conflict as success',async()=>{
    const timeline=createDefaultDirectorTimeline('project-a');
    const mock=clientWith({rpcError:{message:'DIRECTOR_TIMELINE_VERSION_CONFLICT:3:2'}});
    const repository=new DirectorWorkstationTimelineRepository(mock.client);
    await expect(repository.persist({
      projectId:'project-a',
      userId:'user-a',
      expectedVersion:2,
      timeline,
    })).rejects.toThrow('DIRECTOR_TIMELINE_VERSION_CONFLICT');
  });
});
