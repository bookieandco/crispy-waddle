import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {EditableTimeline} from '@jhadina/director-core/timeline-model';

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),
  requireAuthority:vi.fn(),
  load:vi.fn(),
  save:vi.fn(),
  asset:undefined as any,
  approval:undefined as any,
  approvalEq:vi.fn(),
}));

vi.mock('@/lib/supabase/server',()=>({
  createClient:async()=>({auth:{getUser:mocks.getUser}}),
}));

vi.mock('@/lib/director-project-authority',()=>({
  requireDirectorProjectAuthority:mocks.requireAuthority,
}));

function queryFor(table:string):any{
  const query:any={
    select:()=>query,
    eq:(key:string,value:unknown)=>{
      if(table==='director_editing_asset_approvals') mocks.approvalEq(key,value);
      return query;
    },
    maybeSingle:async()=>({
      data:table==='director_generated_editing_assets'?mocks.asset:mocks.approval,
      error:null,
    }),
  };
  return query;
}

const privileged={from:(table:string)=>queryFor(table)};

vi.mock('@/lib/supabase/service-role',()=>({
  createServiceRoleClient:()=>privileged,
}));

vi.mock('@/lib/director-workstation-timeline-repository',()=>({
  DirectorWorkstationTimelineRepository:class{
    load=mocks.load;
    save=mocks.save;
  },
}));

import {POST} from './route';

const timeline:EditableTimeline={
  version:1,
  projectId:'project-a',
  fps:30,
  width:1920,
  height:1080,
  durationSeconds:30,
  playheadSeconds:0,
  tracks:[
    {id:'video-1',name:'Video',kind:'video',clips:[],index:0},
    {id:'audio-1',name:'Audio',kind:'audio',clips:[],index:1},
  ],
  transitions:[],
  markers:[],
  versions:[],
};

function request(){
  return new Request('http://localhost/api/workstation/timeline/command',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      projectId:'project-a',
      expectedRevision:1,
      mutationId:'insert-asset-1',
      command:{
        type:'insert-generated-asset',
        asset:{
          assetId:'asset-video-1',
          generationJobId:'forged-job',
          uri:'https://forged.example/video.mp4',
          mediaType:'video',
          startSeconds:2,
          endSeconds:7,
        },
      },
    }),
  });
}

describe('Workstation timeline command route',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({data:{user:{id:'22222222-2222-2222-2222-222222222222'}}});
    mocks.requireAuthority.mockResolvedValue({projectId:'project-a',role:'editor'});
    mocks.asset={
      id:'asset-video-1',
      project_id:'project-a',
      generation_job_id:'canonical-job',
      media_type:'video',
      uri:'storage://director-media/canonical.mp4',
      mime_type:'video/mp4',
      metadata:{operationId:'op-1'},
    };
    mocks.approval={
      asset_id:'asset-video-1',
      approval_id:'approval:asset-video-1:11111111-1111-1111-1111-111111111111',
      approved_at:'2026-10-03T00:00:00.000Z',
      approved_by_user_id:'11111111-1111-1111-1111-111111111111',
    };
    mocks.load.mockResolvedValue({
      projectId:'project-a',
      createdByUserId:'11111111-1111-1111-1111-111111111111',
      revision:1,
      timeline,
      lastMutationId:'init',
      createdAt:'2026-10-03T00:00:00.000Z',
      updatedAt:'2026-10-03T00:00:00.000Z',
    });
    mocks.save.mockImplementation(async(input:any)=>({
      projectId:input.projectId,
      createdByUserId:'11111111-1111-1111-1111-111111111111',
      revision:2,
      timeline:input.timeline,
      lastMutationId:input.mutationId,
      createdAt:'2026-10-03T00:00:00.000Z',
      updatedAt:'2026-10-03T00:00:01.000Z',
    }));
  });

  it('accepts a durable asset approval made by another authorized project editor',async()=>{
    const response=await POST(request());
    expect(response.status).toBe(200);

    expect(mocks.approvalEq).toHaveBeenCalledWith('asset_id','asset-video-1');
    expect(mocks.approvalEq).not.toHaveBeenCalledWith(
      'approved_by_user_id',
      '22222222-2222-2222-2222-222222222222',
    );

    const saved=mocks.save.mock.calls[0]![0];
    const inserted=saved.timeline.tracks.flatMap((track:any)=>track.clips)
      .find((clip:any)=>clip.assetId==='asset-video-1');
    expect(inserted).toBeDefined();
    expect(inserted.generativeRegions[0].metadata).toMatchObject({
      generationJobId:'canonical-job',
      uri:'storage://director-media/canonical.mp4',
      mimeType:'video/mp4',
      approvalId:'approval:asset-video-1:11111111-1111-1111-1111-111111111111',
      approvedByUserId:'11111111-1111-1111-1111-111111111111',
    });
    expect(JSON.stringify(saved.timeline)).not.toContain('forged.example');
    expect(JSON.stringify(saved.timeline)).not.toContain('forged-job');
  });

  it('still fails closed when the asset has no durable approval',async()=>{
    mocks.approval=undefined;
    const response=await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ok:false,error:'DIRECTOR_ASSET_APPROVAL_REQUIRED'});
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
