export interface GamingSchemaMigration {
  id:string;
  fromVersion:number;
  toVersion:number;
}

export class GamingMigrationPlanner {
  plan(currentVersion:number,targetVersion:number,migrations:readonly GamingSchemaMigration[]):readonly GamingSchemaMigration[]{
    if(!Number.isInteger(currentVersion)||!Number.isInteger(targetVersion)||currentVersion<0||targetVersion<currentVersion)throw new Error('Invalid gaming schema versions');
    const byFrom=new Map(migrations.map(migration=>[migration.fromVersion,migration]));
    const plan:GamingSchemaMigration[]=[];
    let cursor=currentVersion;
    while(cursor<targetVersion){
      const migration=byFrom.get(cursor);
      if(!migration||migration.toVersion!==cursor+1)throw new Error(`No contiguous gaming migration from version ${cursor}`);
      plan.push(migration);cursor=migration.toVersion;
    }
    return plan;
  }
}

export interface GamingRuntimeRelease {
  runtimeId:string;
  version:string;
  digest:string;
  certified:boolean;
}

export class GamingRuntimeReleaseRegistry {
  private readonly history=new Map<string,GamingRuntimeRelease[]>();

  promote(release:GamingRuntimeRelease):void{
    if(!release.certified)throw new Error('Cannot promote uncertified gaming runtime');
    if(!release.version.trim()||!/^sha256:[a-f0-9]{6,}$/i.test(release.digest))throw new Error('Runtime release identity is invalid');
    const versions=this.history.get(release.runtimeId)??[];
    versions.push(Object.freeze({...release}));
    this.history.set(release.runtimeId,versions);
  }

  active(runtimeId:string):GamingRuntimeRelease|undefined{
    return this.history.get(runtimeId)?.at(-1);
  }

  rollback(runtimeId:string):GamingRuntimeRelease{
    const versions=this.history.get(runtimeId);
    if(!versions||versions.length<2)throw new Error('No certified runtime rollback target');
    versions.pop();
    return{...versions.at(-1)!};
  }
}

export interface GamingStorageState {
  usedBytes:number;
  quotaBytes:number;
  reservedForSafeSaveBytes:number;
}

export function canCommitGamingSave(state:GamingStorageState,writeBytes:number):boolean{
  if([state.usedBytes,state.quotaBytes,state.reservedForSafeSaveBytes,writeBytes].some(value=>!Number.isFinite(value)||value<0))throw new Error('Storage values must be finite and non-negative');
  return state.usedBytes+writeBytes<=state.quotaBytes-state.reservedForSafeSaveBytes;
}

export interface GamingTelemetryRetentionPolicy {
  maxAgeDays:number;
  maxSessionRecords:number;
  retainRawInputPayloads:false;
  retainSecrets:false;
}

export const DEFAULT_GAMING_TELEMETRY_RETENTION:GamingTelemetryRetentionPolicy=Object.freeze({
  maxAgeDays:30,
  maxSessionRecords:10000,
  retainRawInputPayloads:false,
  retainSecrets:false,
});

export interface GamingSoakResult {
  durationMinutes:number;
  sessionsStarted:number;
  sessionsStopped:number;
  orphanedResources:number;
  inputIntegrityErrors:number;
  saveCorruptions:number;
  unrecoveredCrashes:number;
}

export interface GamingProductionHardeningDecision {
  passed:boolean;
  reasons:readonly string[];
}

export class GamingProductionHardeningGate {
  evaluate(result:GamingSoakResult):GamingProductionHardeningDecision{
    const reasons:string[]=[];
    if(result.durationMinutes<240)reasons.push('soak-duration-too-short');
    if(result.sessionsStarted<20)reasons.push('insufficient-session-cycles');
    if(result.sessionsStarted!==result.sessionsStopped)reasons.push('session-leak');
    if(result.orphanedResources!==0)reasons.push('orphaned-resources');
    if(result.inputIntegrityErrors!==0)reasons.push('input-integrity-errors');
    if(result.saveCorruptions!==0)reasons.push('save-corruption');
    if(result.unrecoveredCrashes!==0)reasons.push('unrecovered-crashes');
    return{passed:reasons.length===0,reasons};
  }
}

export const G27_PRODUCTION_HARDENING_REQUIREMENTS=Object.freeze([
  'crash-recovery',
  'telemetry-retention',
  'storage-quota-reserve',
  'schema-migrations',
  'backward-compatible-saves',
  'controller-profile-migration',
  'runtime-version-rollback',
  'performance-regression-gates',
  'long-running-soak',
] as const);
