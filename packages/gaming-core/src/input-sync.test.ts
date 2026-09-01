import { describe, expect, it } from 'vitest';
import { InputSynchronizationEngine } from './input-sync.js';
const event=(seq:number,timestampMs=1000)=>({inputId:`i-${seq}`,deviceId:'pad',sequenceNumber:seq,timestampMs,control:'a',value:true});
describe('InputSynchronizationEngine',()=>{
 it('accepts ordered input exactly once',()=>{const e=new InputSynchronizationEngine();expect(e.accept(event(1),1000).accepted).toBe(true);expect(e.accept(event(1),1000).reason).toBe('duplicate');expect(e.accept(event(0),1000).reason).toBe('out-of-order');});
 it('rejects stale input',()=>expect(new InputSynchronizationEngine(50).accept(event(1,900),1000).reason).toBe('stale'));
 it('measures input-to-photon latency',()=>expect(new InputSynchronizationEngine().endToEndMs({inputId:'i',capturedAtMs:1000,presentedAtMs:1024})).toBe(24));
});
