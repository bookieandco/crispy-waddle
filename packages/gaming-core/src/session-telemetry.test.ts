import {describe,expect,it} from 'vitest';
import {GamingSessionMonitor} from './session-telemetry.js';
import type {GamingInputDeliverySnapshot} from './input-delivery-state.js';

describe('GamingSessionMonitor input telemetry',()=>{
  const sample=(
    state:GamingInputDeliverySnapshot['state'],
    observedAtMs:number,
    reason?:string,
    transportDisposition:GamingInputDeliverySnapshot['transportDisposition']='confirmed',
  ):GamingInputDeliverySnapshot=>({
    inputId:'i1',
    sequenceNumber:7,
    sessionId:'s1',
    deviceId:'d1',
    generation:4,
    state,
    sequenceDisposition:'consumed',
    transportDisposition,
    observedAtMs,
    reason,
  });

  it('correlates delivery stages, exact-once metadata, and input-to-photon timing',()=>{
    const monitor=new GamingSessionMonitor();monitor.start('s1','p1','r1',900);
    monitor.recordInputDelivery(sample('transport-started',1010,undefined,'started'),1000);
    monitor.recordInputDelivery(sample('transport-confirmed',1015),1000);
    monitor.recordInputDelivery(sample('runtime-delivered',1020),1000);
    const state=monitor.recordInputDelivery(sample('acknowledged',1022),1000,1030,{status:'over-budget',sentAtMs:1010,confirmedAtMs:1015,latencyMs:5});
    expect(state.latestInput).toMatchObject({
      inputId:'i1',
      sequenceNumber:7,
      generation:4,
      sequenceDisposition:'consumed',
      transportDisposition:'confirmed',
      captureToTransportMs:10,
      captureToRuntimeMs:20,
      inputToPhotonMs:30,
      transportReceiptStatus:'over-budget',
      transportLatencyMs:5,
      deliveryUncertain:false,
    });
    expect(state.inputToPhotonLatencyMs).toBe(30);
    expect(state.inputTransportLatencyMs).toBe(5);
  });

  it('counts an uncertain input once and preserves the diagnostic reason',()=>{
    const monitor=new GamingSessionMonitor();monitor.start('s1','p1','r1',900);
    monitor.recordInputDelivery(sample('transport-started',1010,undefined,'started'),1000);
    const once=monitor.recordInputDelivery(sample('delivery-unknown',1012,'controller-disconnected','unknown'),1000);
    const twice=monitor.recordInputDelivery(sample('delivery-unknown',1012,'controller-disconnected','unknown'),1000);
    expect(once.latestInput).toMatchObject({deliveryState:'delivery-unknown',deliveryUncertain:true,reason:'controller-disconnected',transportDisposition:'unknown'});
    expect(twice.uncertainInputCount).toBe(1);
  });

  it('records reconnect sequence continuity',()=>{
    const monitor=new GamingSessionMonitor();monitor.start('s1','p1','r1',900);
    const state=monitor.recordReconnect('s1',8,1100);
    expect(state).toMatchObject({reconnectCount:1,lastReconnectAtMs:1100,reconnectNextSequenceNumber:8});
  });
});
