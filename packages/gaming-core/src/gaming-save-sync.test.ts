import {describe,expect,it} from 'vitest';
import {GamingSaveCoordinator,InMemoryGamingSaveStore} from './gaming-save-sync.js';

describe('GamingSaveCoordinator',()=>{
  it('preserves game/user/runtime ownership and increments revisions',async()=>{
    const coordinator=new GamingSaveCoordinator(new InMemoryGamingSaveStore());
    const first=await coordinator.write({saveId:'save:g1:0',gameId:'g1',ownerId:'u1',runtimeId:'gameboy-wasm',kind:'state',uri:'save://1',expectedRevision:0,nowMs:100});
    const second=await coordinator.write({saveId:first.saveId,gameId:'g1',ownerId:'u1',runtimeId:'gameboy-wasm',kind:'state',uri:'save://2',expectedRevision:1,nowMs:110});
    expect(second).toMatchObject({revision:2,ownerId:'u1',runtimeId:'gameboy-wasm',uri:'save://2'});
    expect((await coordinator.latest('g1','u1','state'))?.revision).toBe(2);
  });

  it('detects stale writers instead of overwriting a newer save',async()=>{
    const coordinator=new GamingSaveCoordinator(new InMemoryGamingSaveStore());
    await coordinator.write({saveId:'save:g1:0',gameId:'g1',ownerId:'u1',runtimeId:'native-pc',kind:'persistent',uri:'save://1',expectedRevision:0,nowMs:100});
    await expect(coordinator.write({saveId:'save:g1:0',gameId:'g1',ownerId:'u1',runtimeId:'native-pc',kind:'persistent',uri:'save://stale',expectedRevision:0,nowMs:101})).rejects.toThrow('Save conflict');
  });
});
