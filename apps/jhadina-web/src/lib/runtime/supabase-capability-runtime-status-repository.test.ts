import {describe,expect,it} from 'vitest';
import {SupabaseCapabilityRuntimeStatusRepository} from './supabase-capability-runtime-status-repository';

describe('SupabaseCapabilityRuntimeStatusRepository',()=>{
  it('rehydrates durable runtime evidence',async()=>{
    const row={
      capability_name:'director.render',
      subsystem_id:'director',
      state:'ready',
      reason:null,
      evidence:[{
        id:'live-1',source:'worker',observedAt:'2026-09-27T00:00:00Z',
        kind:'live-runtime',summary:'real render completed',
      }],
      updated_at:'2026-09-27T00:00:01Z',
    };
    const client={
      from:()=>({
        select:()=>({
          eq:()=>({maybeSingle:async()=>({data:row,error:null})}),
          order:async()=>({data:[row],error:null}),
        }),
      }),
    } as any;
    const repo=new SupabaseCapabilityRuntimeStatusRepository(client);
    await expect(repo.get('director.render')).resolves.toMatchObject({
      capabilityName:'director.render',
      subsystemId:'director',
      state:'ready',
    });
    await expect(repo.list()).resolves.toHaveLength(1);
  });

  it('persists only the latest descriptive truth shape',async()=>{
    const writes:any[]=[];
    const client={
      from:()=>({
        upsert:async(value:any)=>{writes.push(value);return{error:null};},
      }),
    } as any;
    const repo=new SupabaseCapabilityRuntimeStatusRepository(client);
    await repo.save({
      capabilityName:'shark.trade',
      subsystemId:'shark',
      state:'paper-only',
      reason:'live execution not commissioned',
      evidence:[{
        id:'paper-1',source:'paper-runner',observedAt:'2026-09-27T00:00:00Z',
        kind:'infrastructure',summary:'paper adapter available',
      }],
      updatedAt:'2026-09-27T00:00:01Z',
    });
    expect(writes).toEqual([expect.objectContaining({
      capability_name:'shark.trade',
      subsystem_id:'shark',
      state:'paper-only',
    })]);
  });
});
