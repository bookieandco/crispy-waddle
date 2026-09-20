import {describe,expect,it} from 'vitest';
import {ControllerSessionBindingManager} from './controller-session-binding.js';
import {ControllerInputGate} from './controller-input-gate.js';
import {ControllerInputResyncManager} from './input-resync.js';
import {InputIntegrityMonitor} from './input-integrity.js';
import {GamingInputPipeline} from './input-pipeline.js';
import {GamingInputTransportBoundary,type GamingInputTransport} from './input-transport.js';
import {CertifiedGamingInputSessionController,connectedControllerDevice} from './gaming-input-session-controller.js';

const metrics=()=>({transport:'local' as const,sent:0,delivered:0,dropped:0,duplicated:0,reordered:0});

describe('CertifiedGamingInputSessionController',()=>{
  it('bridges session binding, certified input transport and reconnect sequence continuity',async()=>{
    const bindings=new ControllerSessionBindingManager();
    const integrity=new InputIntegrityMonitor();
    const gate=new ControllerInputGate(bindings);
    const resync=new ControllerInputResyncManager(bindings,integrity);
    const raw:GamingInputTransport={kind:'local',connect:async()=>{},send:async()=>{},disconnect:async()=>{},metrics};
    const transport=new GamingInputTransportBoundary(raw);
    const pipeline=new GamingInputPipeline(integrity,transport,{deliver:async event=>({inputId:event.inputId,sequenceNumber:event.sequenceNumber,deliveredAtMs:Date.now()})},gate,resync);
    const controller=new CertifiedGamingInputSessionController({get:()=>connectedControllerDevice('pad1')},bindings,integrity,resync,gate,transport,pipeline);
    await controller.bind('s1','pad1');
    const now=Date.now();
    expect((await pipeline.submit({inputId:'i0',sequenceNumber:0,capturedAtMs:now,sessionId:'s1',deviceId:'pad1',inputKind:'button'},now)).accepted).toBe(true);
    expect(await controller.disconnect('s1','pad1')).toBe(1);
    expect(await controller.reconnect('s1','pad1')).toBe(1);
    const now2=Date.now();
    expect((await pipeline.submit({inputId:'i1',sequenceNumber:1,capturedAtMs:now2,sessionId:'s1',deviceId:'pad1',inputKind:'button'},now2)).accepted).toBe(true);
    await controller.disconnect('s1','pad1');
    await controller.unbind('s1','pad1');
    expect(bindings.get()?.state).toBe('unbound');
  });
});
