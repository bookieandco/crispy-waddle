import {describe,expect,it} from 'vitest';
import {
  DEFAULT_GAMING_TELEMETRY_RETENTION,
  G27_PRODUCTION_HARDENING_REQUIREMENTS,
  GamingMigrationPlanner,
  GamingProductionHardeningGate,
  GamingRuntimeReleaseRegistry,
  canCommitGamingSave,
} from './gaming-production-hardening.js';

describe('G27 production hardening',()=>{
  it('requires contiguous migrations rather than silently skipping schema versions',()=>{
    const planner=new GamingMigrationPlanner();
    expect(planner.plan(1,3,[{id:'1-2',fromVersion:1,toVersion:2},{id:'2-3',fromVersion:2,toVersion:3}]).map(x=>x.id)).toEqual(['1-2','2-3']);
    expect(()=>planner.plan(1,3,[{id:'1-3',fromVersion:1,toVersion:3}])).toThrow('No contiguous gaming migration');
  });

  it('rolls back only to a previously certified runtime release',()=>{
    const releases=new GamingRuntimeReleaseRegistry();
    releases.promote({runtimeId:'emulatorjs',version:'4.2',digest:'sha256:aaaaaa',certified:true});
    releases.promote({runtimeId:'emulatorjs',version:'4.3',digest:'sha256:bbbbbb',certified:true});
    expect(releases.rollback('emulatorjs').version).toBe('4.2');
  });

  it('preserves a storage reserve so a normal write cannot consume safe-save capacity',()=>{
    expect(canCommitGamingSave({usedBytes:800,quotaBytes:1000,reservedForSafeSaveBytes:100},50)).toBe(true);
    expect(canCommitGamingSave({usedBytes:850,quotaBytes:1000,reservedForSafeSaveBytes:100},60)).toBe(false);
  });

  it('never retains raw input payloads or secrets in default telemetry',()=>{
    expect(DEFAULT_GAMING_TELEMETRY_RETENTION).toMatchObject({retainRawInputPayloads:false,retainSecrets:false});
  });

  it('passes a production soak only with zero leaks, integrity errors, corruptions or unrecovered crashes',()=>{
    const gate=new GamingProductionHardeningGate();
    expect(gate.evaluate({durationMinutes:240,sessionsStarted:25,sessionsStopped:25,orphanedResources:0,inputIntegrityErrors:0,saveCorruptions:0,unrecoveredCrashes:0})).toEqual({passed:true,reasons:[]});
    expect(gate.evaluate({durationMinutes:240,sessionsStarted:25,sessionsStopped:24,orphanedResources:1,inputIntegrityErrors:0,saveCorruptions:0,unrecoveredCrashes:0}).passed).toBe(false);
  });

  it('freezes every G27 hardening domain',()=>{
    expect(G27_PRODUCTION_HARDENING_REQUIREMENTS).toEqual(expect.arrayContaining([
      'crash-recovery','storage-quota-reserve','schema-migrations','runtime-version-rollback','long-running-soak',
    ]));
  });
});
