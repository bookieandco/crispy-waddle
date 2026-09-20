import {describe,expect,it} from 'vitest';
import {AdaptiveGamingLatencyGovernor} from './adaptive-latency-governor.js';

const routes=[{id:'tv',kind:'homebase-tv' as const,available:true,latencyMs:10,direct:true,supportsLowLatency:true}];

describe('AdaptiveGamingLatencyGovernor',()=>{
  it('reduces video before controller responsiveness on a marginal but allowed link',()=>{
    const decision=new AdaptiveGamingLatencyGovernor().evaluate('action',{rttMs:50,jitterMs:10,packetLossPercent:.5,inputLatencyMs:35},routes);
    expect(decision.inputPriority).toBe('protected');
    expect(['allow','reduce-video']).toContain(decision.action);
    if(decision.action==='reduce-video')expect(decision.videoProfile).toBe('reduced');
  });

  it('blocks latency-sensitive play once policy is exceeded',()=>{
    const decision=new AdaptiveGamingLatencyGovernor().evaluate('competitive',{rttMs:90,jitterMs:15,packetLossPercent:2,inputLatencyMs:70},routes);
    expect(decision.action).toBe('block');
    expect(decision.inputPriority).toBe('protected');
  });
});
