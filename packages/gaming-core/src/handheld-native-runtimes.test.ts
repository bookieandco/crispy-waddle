import {describe,expect,it,vi} from 'vitest';
import {NativeHandheldEmulatorDriver,NATIVE_HANDHELD_DEFINITIONS,type NativeHandheldHost,type NativeHandheldId} from './handheld-native-runtimes.js';
import type {GameLibraryEntry} from './game-library.js';
import {InMemoryGameLibrary} from './game-library.js';
import {UnifiedGamingSessionRegistry} from './unified-gaming-session.js';
import {GamingSessionMonitor} from './session-telemetry.js';
import {UnifiedGamingSessionOrchestrator} from './gaming-session-orchestrator.js';
const sha='a'.repeat(64);
const gb:GameLibraryEntry={id:'gb-1',title:'Owned homebrew',platform:'gameboy',contentUri:'gameboy-local://gb-1'};
const gba:GameLibraryEntry={id:'gba-1',title:'Owned GBA homebrew',platform:'gba',contentUri:'gameboy-local://gba-1'};
function fake(id:NativeHandheldId,overrides:{provenanceVerified?:boolean;biosVerified?:boolean;romPath?:string;sourceCommit?:string;licenseReviewed?:boolean;explicitOperatorApproval?:boolean}={}){
 const definition=NATIVE_HANDHELD_DEFINITIONS.find(x=>x.id===id)!;
 const stop=vi.fn(async()=>{});
 const launch=vi.fn(async()=>({processId:'host-42',stop}));
 const host:NativeHandheldHost={
  installation:async()=>({
    runtimeId:id,sourceCommit:overrides.sourceCommit??definition.sourceCommit,
    licenseId:definition.licenseId,platform:'windows',executableSha256:sha,
    version:'1.0',provenanceVerified:overrides.provenanceVerified??true,
    licenseReviewed:overrides.licenseReviewed??true,
    explicitOperatorApproval:overrides.explicitOperatorApproval??true,
  }),
  approvedGame:async(_id,gameId)=>({
    gameId,platform:definition.gamePlatform,romPath:overrides.romPath??(definition.gamePlatform==='gba'?'C:\\roms\\mygame.gba':'C:\\roms\\homebrew.gb'),
    romSha256:sha,userProvided:true,bytesVerified:true,
    biosPath:'C:\\bios\\gba_bios.bin',biosSha256:sha,biosVerified:overrides.biosVerified??true,
  }),
  launch,
 };
 return{host,launch,stop};
}
describe('GAME-FINISH.08 native Game Boy and GBA source admission',()=>{
 it('holds separate pinned upstream sources and licenses',()=>{
  expect(NATIVE_HANDHELD_DEFINITIONS.map(x=>x.gamePlatform)).toEqual(['gba','gameboy']);
  expect(NATIVE_HANDHELD_DEFINITIONS.map(x=>x.licenseId)).toEqual(['GPL-2.0-only','MIT']);
 });
 it('launches PatBoy with exactly one approved native ROM argv and managed stop',async()=>{
  const {host,launch,stop}=fake('patboy-gb');
  const driver=new NativeHandheldEmulatorDriver('patboy-gb',host);
  const lib=new InMemoryGameLibrary();await lib.save(gb);
  const orchestrator=new UnifiedGamingSessionOrchestrator(lib,[driver],new UnifiedGamingSessionRegistry(),new GamingSessionMonitor());
  expect(await driver.canStart(gb)).toBe(true);
  const session=await orchestrator.start({gameId:gb.id,nowMs:100,context:{controllerProfileId:'gamepad'}});
  expect(session.runtimeId).toBe('patboy-gb');
  expect(launch).toHaveBeenCalledOnce();
  expect(launch.mock.calls[0]![0].argv).toEqual(['C:\\roms\\homebrew.gb']);
  expect(launch.mock.calls[0]![0].controllerProfileId).toBe('gamepad');
  await orchestrator.stop(session.sessionId,110);expect(stop).toHaveBeenCalledOnce();
 });
 it('Hades only launches approved GBA games with independently attested BIOS',async()=>{
  const {host,launch}=fake('hades-gba');
  const d=new NativeHandheldEmulatorDriver('hades-gba',host);
  expect(await d.canStart(gb)).toBe(false);
  expect(await d.canStart(gba)).toBe(true);
  await d.start(gba,{});
  expect(launch.mock.calls[0]![0].argv).toEqual(['--bios','C:\\bios\\gba_bios.bin','C:\\roms\\mygame.gba']);
  const missing=new NativeHandheldEmulatorDriver('hades-gba',fake('hades-gba',{biosVerified:false}).host);
  expect(await missing.canStart(gba)).toBe(false);
  await expect(missing.start(gba,{})).rejects.toThrow(/not admitted/i);
 });
 it('rejects unapproved binaries, source revisions and traversal/remote/unsupported cartridges',async()=>{
  for(const opts of [
    {provenanceVerified:false},{licenseReviewed:false},{explicitOperatorApproval:false},
    {sourceCommit:'0'.repeat(40)},{romPath:'https://roms.example/a.gb'},
    {romPath:'C:\\roms\\..\\outside.gb'},{romPath:'C:\\roms\\game.gbc'},
  ]){
    const {host,launch}=fake('patboy-gb',opts);
    const driver=new NativeHandheldEmulatorDriver('patboy-gb',host);
    expect(await driver.canStart(gb)).toBe(false);
    await expect(driver.start(gb,{})).rejects.toThrow(/not admitted/);
    expect(launch).not.toHaveBeenCalled();
  }
 });
 it('stops unexpected unidentifiable native processes',async()=>{
  const {host,stop}=fake('patboy-gb');
  host.launch=async()=>({processId:'',stop});
  const driver=new NativeHandheldEmulatorDriver('patboy-gb',host);
  await expect(driver.start(gb,{})).rejects.toThrow(/no process identity/);
  expect(stop).toHaveBeenCalledOnce();
 });
});
