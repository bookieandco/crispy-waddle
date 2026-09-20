import {describe,expect,it} from 'vitest';
import {InputIntegrityMonitor,type InputIntegrityEvent} from './input-integrity.js';
import {GamingInputPipeline} from './input-pipeline.js';
import type {ControllerInputGate} from './controller-input-gate.js';
import type {ControllerInputResyncManager} from './input-resync.js';
import type {GamingInputTransportBoundary,GamingInputTransportReceipt} from './input-transport.js';

const base:InputIntegrityEvent={inputId:'i0',sequenceNumber:0,capturedAtMs:1000,sessionId:'s1',deviceId:'d1',inputKind:'button'};
const gate={authorize:()=>({allowed:true,reason:'healthy',deviceId:'d1',sessionId:'s1'}),clearHealth:()=>{}} as unknown as ControllerInputGate;
const resync={assertReady:()=>{},disconnect:()=>{}} as unknown as ControllerInputResyncManager;
const receipt=(at=1001):GamingInputTransportReceipt=>({status:'confirmed',sentAtMs:at,confirmedAtMs:at,latencyMs:0});
const boundary=(send:()=>Promise<GamingInputTransportReceipt>,disconnect:()=>Promise<void>=async()=>{})=>({
  send,disconnect,deliveryMode:'transport-only',
}) as unknown as GamingInputTransportBoundary;

describe('GamingInputPipeline exact-once delivery',()=>{
  it('records the complete acknowledged lifecycle',async()=>{
    const integrity=new InputIntegrityMonitor();integrity.bindIdentity('s1','d1');
    const runtime={deliver:async(e:InputIntegrityEvent)=>({inputId:e.inputId,sequenceNumber:e.sequenceNumber,deliveredAtMs:1002})};
    const pipeline=new GamingInputPipeline(integrity,boundary(async()=>receipt()),runtime,gate,resync);
    const result=await pipeline.submit(base,1001);
    expect(result.delivery).toMatchObject({state:'acknowledged',sequenceDisposition:'consumed',transportDisposition:'confirmed'});
    expect(result.transported).toBe(true);
  });

  it('invalidates queued input before it can consume a sequence',async()=>{
    const integrity=new InputIntegrityMonitor();integrity.bindIdentity('s1','d1');
    let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});
    let runtimeStarted!:()=>void;const started=new Promise<void>(resolve=>{runtimeStarted=resolve;});
    let sends=0;
    const transport=boundary(async()=>{sends++;return receipt(1001);});
    const runtime={deliver:async(e:InputIntegrityEvent)=>{runtimeStarted();if(e.sequenceNumber===0)await blocked;return{inputId:e.inputId,sequenceNumber:e.sequenceNumber,deliveredAtMs:1002};}};
    const pipeline=new GamingInputPipeline(integrity,transport,runtime,gate,resync);
    const first=pipeline.submit(base,1001);
    const second=pipeline.submit({...base,inputId:'i1',sequenceNumber:1},1001);
    await started;
    await pipeline.disconnect('s1','d1');
    release();
    await first;
    const result=await second;
    expect(result.delivery).toMatchObject({state:'cancelled-before-send',sequenceDisposition:'not-consumed',transportDisposition:'not-started'});
    expect(sends).toBe(1);
  });

  it('marks delivery unknown when disconnect races with transport send',async()=>{
    const integrity=new InputIntegrityMonitor();integrity.bindIdentity('s1','d1');
    let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});
    let signal!:()=>void;const started=new Promise<void>(resolve=>{signal=resolve;});
    const transport=boundary(async()=>{signal();await blocked;return receipt(Date.now());});
    const runtime={deliver:async(e:InputIntegrityEvent)=>({inputId:e.inputId,sequenceNumber:e.sequenceNumber,deliveredAtMs:Date.now()})};
    const pipeline=new GamingInputPipeline(integrity,transport,runtime,gate,resync);
    const now=Date.now();const pending=pipeline.submit({...base,capturedAtMs:now},now);
    await started;
    await pipeline.disconnect('s1','d1');
    release();
    const result=await pending;
    expect(result.delivery).toMatchObject({state:'delivery-unknown',sequenceDisposition:'consumed',transportDisposition:'unknown'});
    expect(result.transported).toBe(false);
  });

  it('keeps transport confirmed but runtime delivery unknown when disconnect races with runtime',async()=>{
    const integrity=new InputIntegrityMonitor();integrity.bindIdentity('s1','d1');
    let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});
    let signal!:()=>void;const started=new Promise<void>(resolve=>{signal=resolve;});
    const runtime={deliver:async(e:InputIntegrityEvent)=>{signal();await blocked;return{inputId:e.inputId,sequenceNumber:e.sequenceNumber,deliveredAtMs:Date.now()};}};
    const now=Date.now();
    const pipeline=new GamingInputPipeline(integrity,boundary(async()=>receipt(now)),runtime,gate,resync);
    const pending=pipeline.submit({...base,capturedAtMs:now},now);
    await started;
    await pipeline.disconnect('s1','d1');
    release();
    const result=await pending;
    expect(result.delivery).toMatchObject({state:'delivery-unknown',sequenceDisposition:'consumed',transportDisposition:'confirmed'});
    expect(result.transported).toBe(true);
  });

  it('treats mismatched runtime acknowledgement as uncertain and never replayable',async()=>{
    const integrity=new InputIntegrityMonitor();integrity.bindIdentity('s1','d1');
    const runtime={deliver:async()=>({inputId:'wrong',sequenceNumber:99,deliveredAtMs:1002})};
    const pipeline=new GamingInputPipeline(integrity,boundary(async()=>receipt()),runtime,gate,resync);
    const result=await pipeline.submit(base,1001);
    expect(result.delivery).toMatchObject({state:'delivery-unknown',reason:'runtime-ack-mismatch',sequenceDisposition:'consumed',transportDisposition:'confirmed'});
    expect(result.transported).toBe(true);
  });

  it('evaluates implicit freshness when queued input dequeues',async()=>{
    const integrity=new InputIntegrityMonitor(0);integrity.bindIdentity('s1','d1');
    let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});
    let signal!:()=>void;const started=new Promise<void>(resolve=>{signal=resolve;});
    let calls=0;
    const runtime={deliver:async(e:InputIntegrityEvent)=>{calls++;if(calls===1){signal();await blocked;}return{inputId:e.inputId,sequenceNumber:e.sequenceNumber,deliveredAtMs:Date.now()};}};
    const pipeline=new GamingInputPipeline(integrity,boundary(async()=>receipt(Date.now())),runtime,gate,resync);
    const capturedAtMs=Date.now();
    const first=pipeline.submit({...base,inputId:'fresh-0',capturedAtMs},capturedAtMs);
    const queued=pipeline.submit({...base,inputId:'fresh-1',sequenceNumber:1,capturedAtMs});
    await started;
    await new Promise(resolve=>setTimeout(resolve,2));
    release();await first;
    const result=await queued;
    expect(result.accepted).toBe(false);
    expect(result.delivery.state).toBe('stale');
    expect(result.transported).toBe(false);
  });
});
