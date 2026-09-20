import {describe,expect,it} from 'vitest';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';

describe('UnifiedGamingSessionRegistry',()=>{
  it('owns one canonical lifecycle and resource set',()=>{
    const registry=new UnifiedGamingSessionRegistry();
    registry.create({sessionId:'s1',gameId:'g1',runtimeId:'r1',runtimeKind:'remote'},100);
    registry.attachResource('s1','controller:d1',101);
    registry.attachResource('s1','stream:x',102);
    expect(registry.transition('s1','running',103)).toMatchObject({status:'running',resources:['controller:d1','stream:x']});
    registry.transition('s1','degraded',104);
    registry.transition('s1','reconnecting',105);
    registry.transition('s1','running',106);
    registry.transition('s1','stopping',107);
    registry.releaseResource('s1','controller:d1',108);
    registry.releaseResource('s1','stream:x',109);
    const stopped=registry.transition('s1','stopped',110);
    expect(stopped.resources).toEqual([]);
    expect(registry.active()).toEqual([]);
  });

  it('rejects illegal lifecycle jumps',()=>{
    const registry=new UnifiedGamingSessionRegistry();
    registry.create({sessionId:'s1',gameId:'g1',runtimeId:'r1',runtimeKind:'emulator'},100);
    expect(()=>registry.transition('s1','degraded',101)).toThrow('Invalid gaming session transition');
  });
});
