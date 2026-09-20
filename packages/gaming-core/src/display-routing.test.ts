import {describe,expect,it} from 'vitest';
import {selectGamingDisplayRoute} from './display-routing.js';

describe('selectGamingDisplayRoute',()=>{
  it('prefers direct Homebase to TV over phone relay when both are viable',()=>{
    const decision=selectGamingDisplayRoute([
      {id:'phone',kind:'phone-cast',available:true,latencyMs:8,direct:false,supportsLowLatency:true},
      {id:'tv',kind:'homebase-tv',available:true,latencyMs:12,direct:true,supportsLowLatency:true},
    ],{maxLatencyMs:20});
    expect(decision.route?.id).toBe('tv');
  });

  it('blocks display paths outside the latency budget',()=>{
    const decision=selectGamingDisplayRoute([
      {id:'remote',kind:'remote-display',available:true,latencyMs:90,direct:true,supportsLowLatency:false},
    ],{maxLatencyMs:50,requireLowLatency:true});
    expect(decision).toEqual({allowed:false,reason:'no-viable-display-route'});
  });
});
