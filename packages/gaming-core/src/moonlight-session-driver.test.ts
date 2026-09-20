import {describe,expect,it,vi} from 'vitest';
import {MoonlightManagedRuntimeDriver} from './moonlight-session-driver.js';
import type {RemotePlaySessionCoordinator} from './remote-play-session.js';

describe('MoonlightManagedRuntimeDriver',()=>{
  it('requires a paired Sunshine host before exposing a remote runtime',async()=>{
    const coordinator={
      start:vi.fn(async()=>({session:{id:'remote:r1',gameId:'g1',runtimeId:'moonlight-remote',startedAt:'now'},remoteSessionId:'r1',hostId:'homebase',appId:'steam'})),
      stop:vi.fn(async()=>{}),
    } as unknown as RemotePlaySessionCoordinator;
    const paired=new Set(['homebase']);
    const driver=new MoonlightManagedRuntimeDriver(coordinator,{requirePaired:async host=>{if(!paired.has(host))throw new Error('not paired');}});
    const game={id:'g1',title:'Steam',platform:'pc' as const,contentUri:'moonlight://homebase/steam'};
    expect(await driver.canStart(game)).toBe(true);
    const handle=await driver.start(game,{});
    expect(handle.runtimeKind).toBe('remote');
    await handle.stop();
    expect(coordinator.stop).toHaveBeenCalledWith('remote:r1');
  });
});
