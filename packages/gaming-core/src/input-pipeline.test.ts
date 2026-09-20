import {describe,expect,it} from 'vitest';
import {InputIntegrityMonitor,type InputIntegrityEvent} from './input-integrity.js';
import {GamingInputPipeline} from './input-pipeline.js';
import type {ControllerInputGate} from './controller-input-gate.js';
import type {ControllerInputResyncManager} from './input-resync.js';
import type {GamingInputTransportBoundary} from './input-transport.js';

describe('GamingInputPipeline G13ah',()=>{
  const base:InputIntegrityEvent={inputId:'i0',sequenceNumber:0,capturedAtMs:1000,sessionId:'s1',deviceId:'d1',inputKind:'button'};
  const gate={authorize:()=>({allowed:true,reason:'authorized',deviceId:'d1',sessionId:'s1'}),clearHealth:()=>{}} as unknown as ControllerInputGate;
  const resync={assertReady:()=>{},disconnect:()=>{}} as unknown as ControllerInputResyncManager;

  it('records the complete acknowledged lifecycle',async()=>{
    const integrity=new InputIntegrityMonitor(); integrity.bindIdentity('s1','d1');
    const transport={send:async()=>{},deliveryMode:'direct'} as unknown as GamingInputTransportBoundary;
    const runtime={deliver:async(e:InputIntegrityEvent)=>({inputId:e.inputId,sequenceNumber:e.sequenceNumber,deliveredAtMs:1002})};
    const pipeline=new GamingInputPipeline(integrity,transport,runtime,gate,resync);
    const result=await pipeline.submit(base,1001);
    expect(result.delivery.state).toBe('acknowledged');
    expect(result.transported).toBe(true);
  });

  it('invalidates a queued pre-disconnect input before transport',async()=>{
    const integrity=new InputIntegrityMonitor(); integrity.bindIdentity('s1','d1');
    let release!:()=>void; const blocked=new Promise<void>(r=>{release=r;});
    let sends=0;
    const transport={send:async()=>{sends++;},deliveryMode:'direct'} as unknown as GamingInputTransportBoundary;
    const runtime={deliver:async(e:InputIntegrityEvent)=>{if(e.sequenceNumber===0)await blocked;return{inputId:e.inputId,sequenceNumber:e.sequenceNumber,deliveredAtMs:1002};}};
    const pipeline=new GamingInputPipeline(integrity,transport,runtime,gate,resync);
    const first=pipeline.submit(base,1001);
    const second=pipeline.submit({...base,inputId:'i1',sequenceNumber:1},1001);
    await Promise.resolve();
    pipeline.disconnect('s1','d1');
    release();
    await first;
    const result=await second;
    expect(result.delivery.state).toBe('cancelled-before-send');
    expect(result.transported).toBe(false);
    expect(sends).toBe(1);
  });

  it('marks delivery unknown when disconnect races after transport starts',async()=>{
    const integrity=new InputIntegrityMonitor(); integrity.bindIdentity('s1','d1');
    let release!:()=>void; const blocked=new Promise<void>(r=>{release=r;});
    const transport={send:async()=>{await blocked;},deliveryMode:'direct'} as unknown as GamingInputTransportBoundary;
    const runtime={deliver:async(e:InputIntegrityEvent)=>({inputId:e.inputId,sequenceNumber:e.sequenceNumber,deliveredAtMs:1002})};
    const pipeline=new GamingInputPipeline(integrity,transport,runtime,gate,resync);
    const pending=pipeline.submit(base,1001);
    await Promise.resolve();
    pipeline.disconnect('s1','d1');
    release();
    const result=await pending;
    expect(result.delivery.state).toBe('delivery-unknown');
    expect(result.transported).toBe(true);
  });
});
