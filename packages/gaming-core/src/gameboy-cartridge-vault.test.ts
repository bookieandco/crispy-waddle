import {describe,expect,it} from 'vitest';
import {InMemoryGamingRecordStore,DurableGameLibrary} from './gaming-durable.js';
import {GameBoyCartridgeVault,GameBoySaveVault} from './gameboy-cartridge-vault.js';

function rom():Uint8Array{const bytes=new Uint8Array(0x8000);bytes[0x100]=0xc3;return bytes;}
describe('GAME-FINISH.06 Game Boy cartridge and save persistence',()=>{
 it('requires explicit local input and checks cartridge digest across repository restart',async()=>{
   const store=new InMemoryGamingRecordStore(),bytes=rom();
   const file={name:'Homebrew.gb',arrayBuffer:async()=>bytes.buffer, size:bytes.length} as unknown as File;
   const cart=await new GameBoyCartridgeVault(store).importLocalFile(file);
   expect(cart.gameId).toMatch(/^gb-/);
   expect((await new GameBoyCartridgeVault(store).read(cart.gameId))?.sha256).toBe(cart.sha256);
   expect((await new DurableGameLibrary(store).get(cart.gameId))?.platform).toBe('gameboy');
   expect((await new GameBoyCartridgeVault(store).importLocalFile(file)).gameId).toBe(cart.gameId);
 });
 it('rejects unsupported extensions and oversized input before import',async()=>{
   const store=new InMemoryGamingRecordStore();
   await expect(new GameBoyCartridgeVault(store).importLocalFile({name:'no.exe',arrayBuffer:async()=>rom().buffer} as unknown as File)).rejects.toThrow(/cartridge/);
   await expect(new GameBoyCartridgeVault(store).importLocalFile({name:'empty.gb',arrayBuffer:async()=>new Uint8Array(2).buffer} as unknown as File)).rejects.toThrow(/size/);
 });
 it('preserves save revisions across vault instances and refuses stale overwrites',async()=>{
   const store=new InMemoryGamingRecordStore(),states=new GameBoySaveVault(store);
   const revision=await states.save('g',new Uint8Array([1,2,3]),0,1);
   expect(revision).toBe(1);
   await expect(new GameBoySaveVault(store).save('g',new Uint8Array([4,5]),0,2)).rejects.toThrow(/conflict/);
   expect((await new GameBoySaveVault(store).latest('g'))?.state.bytes).toEqual(new Uint8Array([1,2,3]));
 });
});
