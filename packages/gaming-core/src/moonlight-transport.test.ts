import {describe,expect,it,vi} from 'vitest';
import {MoonlightClientAdapter,type MoonlightTransport} from './moonlight-transport.js';
import type {CanonicalGameInput} from './controller.js';

describe('MoonlightClientAdapter',()=>{
  it('delegates discovery, pairing, apps and session operations',async()=>{
    const t:MoonlightTransport={
      discoverHosts:vi.fn(async()=>[]),
      getHostCapabilities:vi.fn(async()=>({video:['hevc'] as const,audio:['stereo'] as const,hdr:true})),
      pair:vi.fn(async()=>{}),
      listApps:vi.fn(async()=>[]),
      launch:vi.fn(async()=>({id:'s',hostId:'h',appId:'a'})),
      sendInput:vi.fn(async()=>{}),
      stop:vi.fn(async()=>{}),
    };
    const c=new MoonlightClientAdapter(t);
    const input:CanonicalGameInput={buttons:new Set(['a']),leftStick:{x:0,y:0},rightStick:{x:0,y:0},timestamp:'2026-09-20T00:00:00.000Z'};
    await c.discoverHosts();await c.getHostCapabilities('h');await c.pair('h','1234');await c.listApps('h');await c.launch('h','a',{});
    await c.sendInput('s',input);
    await c.stop('s');
    expect(t.pair).toHaveBeenCalledWith('h','1234');
    expect(t.listApps).toHaveBeenCalledWith('h');
    expect(t.sendInput).toHaveBeenCalledTimes(1);
  });
});
