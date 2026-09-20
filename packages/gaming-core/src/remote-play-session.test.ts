import { describe, expect, it, vi } from 'vitest';
import { RemotePlaySessionCoordinator } from './remote-play-session.js';
import type { CanonicalGameInput } from './controller.js';
const game={id:'moonlight:homebase:steam',title:'Steam',platform:'pc' as const,contentUri:'moonlight://homebase/steam'};
const canonical:CanonicalGameInput={buttons:new Set(['a']),leftStick:{x:0,y:0},rightStick:{x:0,y:0},timestamp:'2026-09-20T00:00:00.000Z'};
describe('RemotePlaySessionCoordinator',()=>{
 it('starts a remote session and forwards accepted input',async()=>{const client={discoverHosts:async()=>[],launch:vi.fn(async()=>({id:'r1',hostId:'homebase',appId:'steam'})),sendInput:vi.fn(async()=>{}),stop:vi.fn(async()=>{})};const c=new RemotePlaySessionCoordinator(client);const s=await c.start(game);await c.sendInput(s.session.id,{inputId:'i1',deviceId:'pad',sequenceNumber:1,timestampMs:1000,control:'a',value:true,canonical},1000);expect(client.launch).toHaveBeenCalledWith('homebase','steam',{});expect(client.sendInput).toHaveBeenCalledTimes(1);});
 it('drops duplicate input before transport',async()=>{const client={discoverHosts:async()=>[],launch:async()=>({id:'r1',hostId:'h',appId:'a'}),sendInput:vi.fn(async()=>{}),stop:async()=>{}};const c=new RemotePlaySessionCoordinator(client);const s=await c.start({...game,contentUri:'moonlight://h/a'});const input={inputId:'i1',deviceId:'pad',sequenceNumber:1,timestampMs:1000,control:'a',value:true,canonical};await c.sendInput(s.session.id,input,1000);await c.sendInput(s.session.id,input,1000);expect(client.sendInput).toHaveBeenCalledTimes(1);});
});
