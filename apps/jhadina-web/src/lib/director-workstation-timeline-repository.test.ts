import { describe, expect, it, vi } from 'vitest';
import type { EditableTimeline } from '@jhadina/director-core/timeline-model';
import { DirectorWorkstationTimelineRepository } from './director-workstation-timeline-repository';

const timeline: EditableTimeline = {
  version: 1, projectId: 'project-a', fps: 30, width: 1920, height: 1080,
  durationSeconds: 30, playheadSeconds: 0, tracks: [], transitions: [], markers: [], versions: [],
};

describe('DirectorWorkstationTimelineRepository', () => {
  it('loads canonical revision state', async () => {
    const query:any={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{
      project_id:'project-a',created_by_user_id:'user-a',revision:3,timeline,
      last_mutation_id:'m3',created_at:'2026-10-03T00:00:00.000Z',updated_at:'2026-10-03T00:00:03.000Z'
    },error:null})};
    const repository=new DirectorWorkstationTimelineRepository({from:()=>query} as any);
    await expect(repository.load('project-a')).resolves.toEqual(expect.objectContaining({projectId:'project-a',revision:3,timeline}));
  });

  it('binds atomic save to expected revision and mutation identity', async () => {
    const rpc=vi.fn().mockResolvedValue({data:{
      project_id:'project-a',created_by_user_id:'user-a',revision:4,timeline,
      last_mutation_id:'m4',created_at:'2026-10-03T00:00:00.000Z',updated_at:'2026-10-03T00:00:04.000Z'
    },error:null});
    const repository=new DirectorWorkstationTimelineRepository({rpc} as any);
    const saved=await repository.save({projectId:'project-a',userId:'user-a',expectedRevision:3,mutationId:'m4',timeline,reason:'Move clip',now:'2026-10-03T00:00:04.000Z'});
    expect(saved.revision).toBe(4);
    expect(rpc).toHaveBeenCalledWith('save_director_workstation_timeline',expect.objectContaining({p_project_id:'project-a',p_user_id:'user-a',p_expected_revision:3,p_mutation_id:'m4'}));
  });

  it('rejects a forged project binding before persistence', async () => {
    const rpc=vi.fn();
    const repository=new DirectorWorkstationTimelineRepository({rpc} as any);
    await expect(repository.save({projectId:'project-b',userId:'user-a',expectedRevision:1,mutationId:'mx',timeline,reason:'bad'})).rejects.toThrow('DIRECTOR_TIMELINE_PROJECT_BINDING_MISMATCH');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('surfaces stale revision conflicts', async () => {
    const rpc=vi.fn().mockResolvedValue({data:null,error:{message:'DIRECTOR_TIMELINE_STALE_REVISION:expected=2 actual=3'}});
    const repository=new DirectorWorkstationTimelineRepository({rpc} as any);
    await expect(repository.save({projectId:'project-a',userId:'user-a',expectedRevision:2,mutationId:'stale',timeline,reason:'Move clip'})).rejects.toThrow('DIRECTOR_TIMELINE_STALE_REVISION');
  });
});
