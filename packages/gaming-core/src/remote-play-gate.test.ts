import {describe,expect,it,vi} from 'vitest';
import {RemotePlayGate} from './remote-play-gate.js';
const game={id:'moonlight:h:app',title:'Game',platform:'pc' as const,contentUri:'moonlight://h/app'};
const client={discoverHosts:async()=>[],launch:vi.fn(async()=>({id:'r',hostId:'h',appId:'app'})),sendInput:async()=>{},stop:async()=>{}};
describe('RemotePlayGate',()=>{it('blocks poor competitive connections before launch',async()=>{const gate=new RemotePlayGate(client);await expect(gate.start({game,playClass:'competitive',quality:{rttMs:100,jitterMs:20,packetLossPercent:2,inputLatencyMs:60}})).rejects.toThrow('Remote launch blocked');expect(client.launch).not.toHaveBeenCalled();});it('launches when quality passes',async()=>{const gate=new RemotePlayGate(client);await gate.start({game,playClass:'action',quality:{rttMs:20,jitterMs:3,packetLossPercent:0,inputLatencyMs:20}});expect(client.launch).toHaveBeenCalled();});});
