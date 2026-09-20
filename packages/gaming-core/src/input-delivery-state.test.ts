import {describe,expect,it} from 'vitest';
import {GamingInputDeliveryTracker} from './input-delivery-state.js';

describe('GamingInputDeliveryTracker',()=>{
  it('tracks successful exact-once delivery',()=>{
    const tracker=new GamingInputDeliveryTracker();
    tracker.capture({inputId:'i1',sequenceNumber:0,sessionId:'s1',deviceId:'d1',generation:3},1);
    tracker.transition('i1','authorized',2);
    tracker.transition('i1','integrity-accepted',3);
    tracker.transition('i1','transport-started',4);
    tracker.transition('i1','transport-confirmed',5);
    tracker.transition('i1','runtime-delivered',6);
    expect(tracker.transition('i1','acknowledged',7)).toMatchObject({state:'acknowledged',generation:3,sequenceDisposition:'consumed',transportDisposition:'confirmed'});
  });

  it('disconnect before integrity acceptance is replay-safe',()=>{
    const tracker=new GamingInputDeliveryTracker();
    tracker.capture({inputId:'i1',sequenceNumber:0},1);
    tracker.transition('i1','authorized',2);
    expect(tracker.markDisconnect('i1',3)).toMatchObject({state:'cancelled-before-send',sequenceDisposition:'not-consumed',transportDisposition:'not-started'});
  });

  it('disconnect after integrity acceptance consumes the sequence without claiming send',()=>{
    const tracker=new GamingInputDeliveryTracker();
    tracker.capture({inputId:'i1',sequenceNumber:0},1);
    tracker.transition('i1','authorized',2);
    tracker.transition('i1','integrity-accepted',3);
    expect(tracker.markDisconnect('i1',4)).toMatchObject({state:'cancelled-after-accept',sequenceDisposition:'consumed',transportDisposition:'not-started'});
  });

  it('disconnect after transport starts is uncertain and consumed',()=>{
    const tracker=new GamingInputDeliveryTracker();
    tracker.capture({inputId:'i1',sequenceNumber:0},1);
    tracker.transition('i1','authorized',2);
    tracker.transition('i1','integrity-accepted',3);
    tracker.transition('i1','transport-started',4);
    expect(tracker.markDisconnect('i1',5)).toMatchObject({state:'delivery-unknown',sequenceDisposition:'consumed',transportDisposition:'unknown'});
  });

  it('rejects illegal lifecycle jumps and non-monotonic timestamps',()=>{
    const tracker=new GamingInputDeliveryTracker();
    tracker.capture({inputId:'i1',sequenceNumber:0},10);
    expect(()=>tracker.transition('i1','acknowledged',11)).toThrow('Invalid input delivery transition');
    expect(()=>tracker.transition('i1','authorized',9)).toThrow('monotonic');
  });
});
