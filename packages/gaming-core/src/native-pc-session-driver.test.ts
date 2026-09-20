import {describe,expect,it,vi} from 'vitest';
import {NativePcManagedRuntimeDriver} from './native-pc-session-driver.js';

describe('NativePcManagedRuntimeDriver',()=>{
  it('launches Steam/native PC targets and owns their process lifetime',async()=>{
    const stop=vi.fn(async()=>{});
    const launch=vi.fn(async()=>({processId:'4242',stop}));
    const driver=new NativePcManagedRuntimeDriver({launch});
    const game={id:'steam:400',title:'Portal',platform:'pc' as const,contentUri:'steam://run/400'};
    expect(await driver.canStart(game)).toBe(true);
    const handle=await driver.start(game,{performanceProfileId:'low-latency'});
    expect(handle).toMatchObject({runtimeSessionId:'process:4242',runtimeKind:'native'});
    expect(launch).toHaveBeenCalledWith('steam://run/400',{performanceProfileId:'low-latency'});
    await handle.stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed Steam targets',async()=>{
    const driver=new NativePcManagedRuntimeDriver({launch:async()=>({processId:'x',stop:async()=>{}})});
    expect(await driver.canStart({id:'bad',title:'Bad',platform:'pc',contentUri:'steam://run/nope'})).toBe(false);
  });
});
