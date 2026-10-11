import {describe,expect,it,vi} from 'vitest';
import {InMemoryGamingRecordStore,DurableGameLibrary} from './gaming-durable.js';
import {createLocalGameBoyManagedRuntime,LocalGameBoyRomSource} from './gameboy-local-runtime.js';
import {GameBoyCartridgeVault} from './gameboy-cartridge-vault.js';
import {UnifiedGamingSessionOrchestrator} from './gaming-session-orchestrator.js';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';
import {GamingSessionMonitor} from './session-telemetry.js';
import type {GameBoyWasmModule} from './gameboy-wasm-bridge.js';

describe('GAME-FINISH.06 end-to-end local Game Boy adapter',()=>{
 it('runs a locally imported game using managed session and verified ROM bytes',async()=>{
   const store=new InMemoryGamingRecordStore(),bytes=new Uint8Array(0x8000);
   bytes[0x0100]=0xc3;
   const cart=await new GameBoyCartridgeVault(store).importLocalFile({name:'homebrew.gb',arrayBuffer:async()=>bytes.buffer} as unknown as File);
   const load=vi.fn(async(bytes:Uint8Array)=>{expect(bytes[0x0100]).toBe(0xc3)});
   const stop=vi.fn(async()=>{});
   const gameModule:GameBoyWasmModule={loadRom:load,start:async()=>{},pause:async()=>{},resume:async()=>{},stop,setButton:()=>{}};
   const {host,driver}=createLocalGameBoyManagedRuntime(store,{create:async()=>gameModule});
   const sessions=new UnifiedGamingSessionOrchestrator(new DurableGameLibrary(store),[driver],new UnifiedGamingSessionRegistry(),new GamingSessionMonitor());
   const session=await sessions.start({gameId:cart.gameId,nowMs:1});
   expect(session.status).toBe('running');
   expect(load).toHaveBeenCalledOnce();
   const handleId=session.resources.find(id=>id.startsWith('runtime:'))!.slice('runtime:'.length);
   expect(host.get(handleId)?.setInput).toBeTypeOf('function');
   const ended=await sessions.stop(session.sessionId,2);
   expect(ended.status).toBe('stopped');
   expect(stop).toHaveBeenCalledOnce();
   expect(sessions.runtimeHandleCount()).toBe(0);
 });
 it('refuses untrusted URI schemes before reading cartridge bytes',async()=>{
   const source=new LocalGameBoyRomSource(new GameBoyCartridgeVault(new InMemoryGamingRecordStore()));
   await expect(source.read('https://example.com/game.gb')).rejects.toThrow(/previously imported/);
   await expect(source.read('gameboy-local://gb-000000000000000000000000')).rejects.toThrow(/unavailable/);
 });
});
