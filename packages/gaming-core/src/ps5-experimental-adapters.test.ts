import {describe,expect,it,vi} from 'vitest';
import {Ps5ExperimentalReferenceCatalog} from './ps5-experimental-catalog.js';
import {KytyExperimentalRuntimeDriver,Ps5MqttObservationAdapter,Ps5PayloadMetadataAdapter} from './ps5-experimental-adapters.js';

describe('PS5 experimental adapters',()=>{
  const catalog=new Ps5ExperimentalReferenceCatalog();
  const approved={experimentalModeEnabled:true,explicitUserApproval:true};

  it('allows approved PS5 state observation without exposing credentials',async()=>{
    const adapter=new Ps5MqttObservationAdapter({discover:async()=>[{consoleId:'ps5-1',name:'Living Room PS5',state:'standby'}]},catalog.get('ps5-mqtt')!);
    expect(await adapter.discover(approved)).toEqual([{consoleId:'ps5-1',name:'Living Room PS5',state:'standby'}]);
  });

  it('launches only the approved emulator runtime through the managed session contract',async()=>{
    const stop=vi.fn(async()=>{});
    const driver=new KytyExperimentalRuntimeDriver(
      {launch:async()=>({processId:'77',stop})},
      catalog.get('kyty')!,
      ()=>approved,
    );
    const game={id:'ps5:test',title:'Test',platform:'ps5' as const,contentUri:'experimental://test'};
    expect(await driver.canStart(game)).toBe(true);
    const handle=await driver.start(game,{});
    expect(handle).toMatchObject({runtimeSessionId:'kyty:77',runtimeKind:'emulator'});
    await handle.stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('sanitizes payload catalog metadata without surfacing executable/download fields',()=>{
    const adapter=new Ps5PayloadMetadataAdapter(catalog.get('ps5-payloads-mirror')!);
    expect(adapter.sanitize([{name:'  Example Tool  ',version:' 1.0 ',description:' metadata ',sourceRepository:' owner/repo '}],approved))
      .toEqual([{name:'Example Tool',version:'1.0',description:'metadata',sourceRepository:'owner/repo'}]);
  });
});
