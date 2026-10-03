import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {EditableTimeline} from '@jhadina/director-core/timeline-model';

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),
  requireAuthority:vi.fn(),
  load:vi.fn(),
  insert:vi.fn(),
}));

vi.mock('@/lib/supabase/server',()=>({
  createClient:async()=>({auth:{getUser:mocks.getUser}}),
}));
vi.mock('@/lib/director-project-authority',()=>({
  requireDirectorProjectAuthority:mocks.requireAuthority,
}));
const proposalQuery:any={
  insert:(value:any)=>{mocks.insert(value);return proposalQuery;},
  select:()=>proposalQuery,
  single:async()=>({data:{
    id:'proposal-1',project_id:'project-a',timeline_revision:3,clip_id:'clip-1',
    start_seconds:1,duration_seconds:2,instruction:'extend',status:'pending_approval',
    created_at:'2026-10-03T00:00:00.000Z',
  },error:null}),
};
const privileged={from:()=>proposalQuery};
vi.mock('@/lib/supabase/service-role',()=>({
  createServiceRoleClient:()=>privileged,
}));
vi.mock('@/lib/director-workstation-timeline-repository',()=>({
  DirectorWorkstationTimelineRepository:class{load=mocks.load;},
}));

import {POST} from './route';

const timeline:EditableTimeline={
  version:1,projectId:'project-a',fps:30,width:1920,height:1080,durationSeconds:30,playheadSeconds:0,
  tracks:[{id:'video-1',name:'Video',kind:'video',index:0,clips:[{
    id:'clip-1',assetId:'asset-1',trackId:'video-1',startSeconds:0,durationSeconds:5,
    sourceInSeconds:0,sourceOutSeconds:5,sourceDurationSeconds:5,effects:[],generativeRegions:[],
  }]}],
  transitions:[],markers:[],versions:[],
};

function request(expectedRevision?:number){
  return new Request('http://localhost/api/workstation/timeline/generative-region',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      projectId:'project-a',clipId:'clip-1',startSeconds:1,durationSeconds:2,
      instruction:'extend',...(expectedRevision===undefined?{}:{expectedRevision}),
    }),
  });
}

describe('Workstation generative-region route',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({data:{user:{id:'user-a'}}});
    mocks.requireAuthority.mockResolvedValue({projectId:'project-a',role:'editor'});
    mocks.load.mockResolvedValue({
      projectId:'project-a',createdByUserId:'owner-a',revision:3,timeline,
      lastMutationId:'m3',createdAt:'2026-10-03T00:00:00.000Z',updatedAt:'2026-10-03T00:00:03.000Z',
    });
  });

  it('requires an explicit canonical timeline revision',async()=>{
    const response=await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({error:'DIRECTOR_TIMELINE_EXPECTED_REVISION_REQUIRED'});
    expect(mocks.requireAuthority).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rejects stale proposals instead of silently rebinding them to a newer timeline',async()=>{
    const response=await POST(request(2));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({error:'DIRECTOR_TIMELINE_STALE_REVISION:expected=2 actual=3'});
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('persists a proposal pinned to the exact admitted revision',async()=>{
    const response=await POST(request(3));
    expect(response.status).toBe(202);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      project_id:'project-a',
      timeline_revision:3,
      clip_id:'clip-1',
      status:'pending_approval',
      created_by_user_id:'user-a',
    }));
  });
});
