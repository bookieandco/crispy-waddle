import {describe,expect,it} from 'vitest';
import {InputIntegrityMonitor,type InputIntegrityEvent} from './input-integrity.js';
import {GamingInputPipeline} from './input-pipeline.js';
import type {ControllerInputGate} from './controller-input-gate.js';
import type {ControllerInputResyncManager} from './input-resync.js';
import type {GamingInputTransportBoundary} from './input-transport.js';

describe('GamingInputPipeline',()=>{
  const event:InputIntegrityEvent={inputId:'input-1',sequenceNumber:5,capturedAtMs:1000,sessionId:'session-1',deviceId:'device-1',inputKind:'trigger'};

  it('contains capability-denied input before integrity mutation or transport',async()=>{
    const integrity=new InputIntegrityMonitor();
    integrity.bindIdentity('session-1','device-1');
    let sends=0;
    let resyncChecks=0;
    const controllerGate={authorize:()=>({allowed:false,reason:'controller-capability-mismatch' as const,deviceId:'device-1',sessionId:'session-1'})} as unknown as ControllerInputGate;
    const transport={send:async()=>{sends++;},deliveryMode:'runtime-delivery',deliverToRuntime:async()=>({inputId:event.inputId,sequenceNumber:event.sequenceNumber,deliveredAtMs:1001})} as unknown as GamingInputTransportBoundary;
    const runtime={deliver:async()=>({inputId:event.inputId,sequenceNumber:event.sequenceNumber,deliveredAtMs:1001})};
    const resync={assertReady:()=>{resyncChecks++;}} as unknown as ControllerInputResyncManager;
    const pipeline=new GamingInputPipeline(integrity,transport,runtime,controllerGate,resync);

    const result=await pipeline.submit(event,1001);
    expect(result.accepted).toBe(false);
    expect(result.state).toBe('healthy');
    expect(result.lastSequenceNumber).toBe(-1);
    expect(result.expectedSequenceNumber).toBe(0);
    expect(result.transported).toBe(false);
    expect(sends).toBe(0);
    expect(resyncChecks).toBe(0);
    expect(integrity.snapshot().acceptedCount).toBe(0);
    expect(integrity.snapshot().staleCount).toBe(0);
    expect(integrity.snapshot().duplicateCount).toBe(0);
    expect(integrity.snapshot().reorderedCount).toBe(0);
  });

  it('serializes concurrent submissions in invocation order',async()=>{
    const integrity=new InputIntegrityMonitor();
    integrity.bindIdentity('session-1','device-1');
    const controllerGate={authorize:()=>({allowed:true,reason:'authorized' as const,deviceId:'device-1',sessionId:'session-1'})} as unknown as ControllerInputGate;
    const delivered:number[]=[];
    let releaseFirst!:()=>void;
    const firstBlocked=new Promise<void>(resolve=>{releaseFirst=resolve;});
    const runtime={deliver:async(input:InputIntegrityEvent)=>{delivered.push(input.sequenceNumber);if(input.sequenceNumber===0)await firstBlocked;return{inputId:input.inputId,sequenceNumber:input.sequenceNumber,deliveredAtMs:input.capturedAtMs+1};}};
    const transport={send:async()=>{},deliveryMode:'direct'} as unknown as GamingInputTransportBoundary;
    const resync={assertReady:()=>{}} as unknown as ControllerInputResyncManager;
    const pipeline=new GamingInputPipeline(integrity,transport,runtime,controllerGate,resync);
    const first={...event,inputId:'input-1',sequenceNumber:0,capturedAtMs:1000};
    const second={...event,inputId:'input-2',sequenceNumber:1,capturedAtMs:1000};
    const firstResult=pipeline.submit(first,1001);
    const secondResult=pipeline.submit(second,1001);
    await Promise.resolve();
    expect(delivered).toEqual([0]);
    releaseFirst();
    await Promise.all([firstResult,secondResult]);
    expect(delivered).toEqual([0,1]);
  });

  it('continues processing after a failed submission',async()=>{
    const integrity=new InputIntegrityMonitor();
    integrity.bindIdentity('session-1','device-1');
    const controllerGate={authorize:()=>({allowed:true,reason:'authorized' as const,deviceId:'device-1',sessionId:'session-1'})} as unknown as ControllerInputGate;
    let calls=0;
    const runtime={deliver:async(input:InputIntegrityEvent)=>{calls++;if(calls===1)throw new Error('runtime failure');return{inputId:input.inputId,sequenceNumber:input.sequenceNumber,deliveredAtMs:1001};}};
    const transport={send:async()=>{},deliveryMode:'direct'} as unknown as GamingInputTransportBoundary;
    const resync={assertReady:()=>{}} as unknown as ControllerInputResyncManager;
    const pipeline=new GamingInputPipeline(integrity,transport,runtime,controllerGate,resync);
    const first={...event,inputId:'input-1',sequenceNumber:0,capturedAtMs:1000};
    const second={...event,inputId:'input-2',sequenceNumber:1,capturedAtMs:1000};
    const firstResult=pipeline.submit(first,1001);
    const secondResult=pipeline.submit(second,1001);
    await expect(firstResult).rejects.toThrow('runtime failure');
    await expect(secondResult).resolves.toMatchObject({accepted:true,acknowledgement:{sequenceNumber:1}});
    expect(calls).toBe(2);
  });
});
