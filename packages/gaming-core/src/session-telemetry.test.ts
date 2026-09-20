import {describe,expect,it} from 'vitest';
import {GamingSessionMonitor} from './session-telemetry.js';
import type {GamingInputDeliverySnapshot} from './input-delivery-state.js';

describe('GamingSessionMonitor input telemetry',()=>{
  const sample=(state:GamingInputDeliverySnapshot['state'],observedAtMs:number,reason?:string):GamingInputDeliverySnapshot=>({inputId:'i1',sequenceNumber:7,sessionId:'s1',deviceId:'d1',state,observedAtMs,reason});

  it('correlates delivery stages with input-to-photon timing',()=>{
    const monitor=new GamingSessionMonitor();monitor.start('s1','p1','r1',900);
    monitor.recordInputDelivery(sample('transport-started',1010),1000);
    monitor.recordInputDelivery(sample('transport-confirmed',1015),1000);
    monitor.recordInputDelivery(sample('runtime-delivered',1020),1000);
    const state=monitor.recordInputDelivery(sample('acknowledged',1022),1000,1030);
    expect(state.latestInput).toMatchObject({inputId:'i1',sequenceNumber:7,captureToTransportMs:10,captureToRuntimeMs:20,inputToPhotonMs:30,deliveryUncertain:false});
    expect(state.inputToPhotonLatencyMs).toBe(30);
  });

  it('records uncertain delivery without pretending non-delivery',()=>{
    const monitor=new GamingSessionMonitor();monitor.start('s1','p1','r1',900);
    monitor.recordInputDelivery(sample('transport-started',1010),1000);
    const state=monitor.recordInputDelivery(sample('delivery-unknown',1012,'controller-disconnected'),1000);
    expect(state.latestInput).toMatchObject({deliveryState:'delivery-unknown',deliveryUncertain:true,reason:'controller-disconnected'});
    expect(state.uncertainInputCount).toBe(1);
  });
});
