import {describe,expect,it} from 'vitest';
import {ControllerInputGate} from './controller-input-gate.js';
import type {ControllerSessionBindingManager} from './controller-session-binding.js';
import type {ControllerHealthResult} from './controller-health.js';
import type {InputIntegrityEvent} from './input-integrity.js';

describe('ControllerInputGate typed input validation',()=>{
  const event=(inputKind:string):InputIntegrityEvent=>({inputId:'i1',sequenceNumber:0,capturedAtMs:1000,sessionId:'s1',deviceId:'d1',inputKind:inputKind as InputIntegrityEvent['inputKind']});
  const binding={get:()=>({state:'bound',sessionId:'s1',deviceId:'d1',capabilities:['buttons','axes','triggers','dpad','haptics']}),assertBound:(s:string,d:string)=>({state:'bound',sessionId:s,deviceId:d,capabilities:['buttons','axes','triggers','dpad','haptics']})} as unknown as ControllerSessionBindingManager;
  const health={accepted:true,state:'healthy',deviceId:'d1'} as ControllerHealthResult;
  it('rejects an invalid input kind before binding or health checks',()=>{
    let bound=0;
    const guarded={get:()=>({state:'bound',sessionId:'s1',deviceId:'d1',capabilities:['buttons']}),assertBound:()=>{bound++;throw new Error('must not be reached');}} as unknown as ControllerSessionBindingManager;
    const gate=new ControllerInputGate(guarded);
    const result=gate.authorize(event('not-a-real-input-kind'),1000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('controller-capability-mismatch');
    expect(bound).toBe(0);
  });
  it('accepts every canonical typed input kind when capability is present',()=>{
    const gate=new ControllerInputGate(binding);
    for(const kind of ['button','axis','trigger','dpad','haptic'] as const){
      const result=gate.authorize(event(kind),1000);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('controller-unhealthy');
    }
  });
});
