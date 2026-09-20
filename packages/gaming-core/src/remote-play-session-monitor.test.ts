import {describe,expect,it} from 'vitest';
import {RemotePlaySessionMonitor,type RemoteSessionHealth} from './remote-play-session-monitor.js';
const session={session:{id:'remote:r1',gameId:'g',runtimeId:'moonlight-remote',startedAt:'now'},remoteSessionId:'r1',hostId:'h',appId:'a'};
const policy={maxRttMs:50,maxJitterMs:8,maxPacketLossPercent:.5,maxInputLatencyMs:35};
describe('RemotePlaySessionMonitor',()=>{
 it('routes samples through degradation policy',async()=>{const events:RemoteSessionHealth[]=[];const monitor=new RemotePlaySessionMonitor(async()=>({rttMs:20,jitterMs:2,packetLossPercent:0,inputLatencyMs:10}),h=>events.push(h));monitor.start(session,policy,60000);await monitor.sample();monitor.stop();expect(events.at(-1)?.action).toBe('none');expect(events.at(-1)?.sessionId).toBe('remote:r1');});
 it('surfaces degraded action',async()=>{const events:RemoteSessionHealth[]=[];const monitor=new RemotePlaySessionMonitor(async()=>({rttMs:49,jitterMs:8,packetLossPercent:.1,inputLatencyMs:30}),h=>events.push(h));monitor.start(session,policy,60000);await monitor.sample();monitor.stop();expect(events.at(-1)?.action).toBe('reduce-video');});
});
