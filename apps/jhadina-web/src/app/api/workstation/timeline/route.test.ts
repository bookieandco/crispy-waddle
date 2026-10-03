import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),
  requireAuthority:vi.fn(),
  save:vi.fn(),
}));

vi.mock('@/lib/supabase/server',()=>({
  createClient:async()=>({auth:{getUser:mocks.getUser}}),
}));

vi.mock('@/lib/supabase/service-role',()=>({
  createServiceRoleClient:()=>({}),
}));

vi.mock('@/lib/director-project-authority',()=>({
  requireDirectorProjectAuthority:mocks.requireAuthority,
}));

vi.mock('@/lib/director-workstation-timeline-repository',()=>({
  DirectorWorkstationTimelineRepository:class {
    save=mocks.save;
  },
}));

import {POST} from './route';

function request(body:Record<string,unknown>){
  return new Request('http://localhost/api/workstation/timeline',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
  });
}

describe('Workstation timeline initialization route',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({data:{user:{id:'11111111-1111-1111-1111-111111111111'}}});
    mocks.requireAuthority.mockResolvedValue({projectId:'project-a',role:'owner'});
    mocks.save.mockImplementation(async(input:any)=>({
      projectId:input.projectId,
      createdByUserId:input.userId,
      revision:1,
      timeline:input.timeline,
      lastMutationId:input.mutationId,
      createdAt:'2026-10-03T00:00:00.000Z',
      updatedAt:'2026-10-03T00:00:00.000Z',
    }));
  });

  it('creates only the server-owned empty canonical timeline',async()=>{
    const response=await POST(request({
      projectId:'project-a',
      expectedRevision:0,
      mutationId:'init-1',
      reason:'Initialize empty Workstation timeline',
      timeline:{
        projectId:'project-a',
        tracks:[{id:'forged',kind:'video',clips:[{id:'forged-clip',uri:'https://evil.example/video.mp4'}]}],
      },
    }));

    expect(response.status).toBe(201);
    expect(mocks.requireAuthority).toHaveBeenCalledWith({},{
      projectId:'project-a',
      userId:'11111111-1111-1111-1111-111111111111',
      capability:'edit',
    });
    const saved=mocks.save.mock.calls[0]![0];
    expect(saved.expectedRevision).toBe(0);
    expect(saved.timeline).toMatchObject({
      projectId:'project-a',
      fps:30,
      width:1920,
      height:1080,
      durationSeconds:30,
      playheadSeconds:0,
      transitions:[],
      markers:[],
      versions:[],
    });
    expect(saved.timeline.tracks).toEqual([
      {id:'video-1',name:'Video',kind:'video',clips:[],index:0},
      {id:'audio-1',name:'Audio',kind:'audio',clips:[],index:1},
    ]);
    expect(JSON.stringify(saved.timeline)).not.toContain('evil.example');
  });

  it('rejects use of the initialization endpoint as a full-timeline overwrite',async()=>{
    const response=await POST(request({
      projectId:'project-a',
      expectedRevision:7,
      mutationId:'overwrite-attempt',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok:false,
      error:'DIRECTOR_TIMELINE_INITIALIZATION_REVISION_MUST_BE_ZERO',
    });
    expect(mocks.requireAuthority).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
