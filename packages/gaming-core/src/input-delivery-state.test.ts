import {describe,expect,it} from 'vitest';
import {GamingInputDeliveryTracker} from './input-delivery-state.js';

describe('GamingInputDeliveryTracker',()=>{
  it('tracks the successful exact-once delivery lifecycle',()=>{
    const tracker=new GamingInputDeliveryTracker();
    tracker.capture({inputId:'i1',sequenceNumber:0,sessionId:'s1',deviceId:'d1'},1);
    tracker.transition('i1','authorized',2);
    tracker.transition('i1','integrity-accepted',3);
    tracker.transition('i1','transport-started',4);
    tracker.transition('i1','transport-confirmed',5);
    tracker.transition('i1','runtime-delivered',6);
    expect(tracker.transition('i1','acknowledged',7)).toMatchObject({state:'acknowledged',sequenceNumber:0});
    expect(()=>tracker.transition('i1','failed',8)).toThrow('terminal');
  });

  it('cancels safely when disconnect happens before transport starts',()=>{
    const tracker=new GamingInputDeliveryTracker();
    tracker.capture({inputId:'i1',sequenceNumber:0},1);
    tracker.transition('i1','authorized',2);
    expect(tracker.markDisconnect('i1',3)).toMatchObject({state:'cancelled-before-send',reason:'controller-disconnected'});
  });

  it('marks delivery unknown when disconnect happens after transport starts',()=>{
    const tracker=new GamingInputDeliveryTracker();
    tracker.capture({inputId:'i1',sequenceNumber:0},1);
    tracker.transition('i1','authorized',2);
    tracker.transition('i1','integrity-accepted',3);
    tracker.transition('i1','transport-started',4);
    expect(tracker.markDisconnect('i1',5)).toMatchObject({state:'delivery-unknown',reason:'controller-disconnected'});
  });

  it('rejects illegal lifecycle jumps and non-monotonic timestamps',()=>{
    const tracker=new GamingInputDeliveryTracker();
    tracker.capture({inputId:'i1',sequenceNumber:0},10);
    expect(()=>tracker.transition('i1','acknowledged',11)).toThrow('Invalid input delivery transition');
    expect(()=>tracker.transition('i1','authorized',9)).toThrow('monotonic');
  });
});
