import {describe,expect,it} from 'vitest';
import {EmulatorSourceRegistry} from './emulator-source-registry.js';

describe('EmulatorSourceRegistry',()=>{
  const registry=new EmulatorSourceRegistry();
  const complete=(sourceId:string)=>({
    sourceId,
    provenanceVerified:true,
    licenseReviewed:true,
    maintenanceReviewed:true,
    inputReviewed:true,
    saveReviewed:true,
    firmwareRequirementsReviewed:true,
    securityReviewed:true,
    explicitUserApproval:true,
  });

  it('keeps curated lists as discovery sources rather than executable trust anchors',()=>{
    expect(registry.promote(complete('awesome-emulators'))).toEqual({allowed:false,reason:'discovery-source-only'});
    expect(registry.promote(complete('jsemu'))).toEqual({allowed:false,reason:'discovery-source-only'});
  });

  it('requires a complete audit and explicit approval before runtime promotion',()=>{
    expect(registry.promote({...complete('retroemu'),securityReviewed:false})).toEqual({allowed:false,reason:'audit-incomplete'});
    expect(registry.promote({...complete('retroemu'),explicitUserApproval:false})).toEqual({allowed:false,reason:'explicit-approval-required'});
    expect(registry.promote(complete('retroemu'))).toEqual({allowed:true,reason:'approved'});
  });

  it('never treats hardware flashing as an automatic embedded action',()=>{
    expect(registry.get('retro-go')?.neverAutomatic).toContain('flash-device');
  });

  it('records browser, native, libretro and embedded execution classes separately',()=>{
    expect(registry.get('emulatorjs')?.kind).toBe('browser-runtime');
    expect(registry.get('retroemu')?.kind).toBe('libretro-wasm');
    expect(registry.get('game-box')?.kind).toBe('native-runtime');
    expect(registry.get('retro-go')?.kind).toBe('embedded-runtime');
  });
});
