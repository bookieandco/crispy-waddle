export const G28_FAILURE_DRILLS=Object.freeze([
 'controller-unplug','bluetooth-drop','wifi-loss','host-restart','browser-refresh','runtime-crash',
 'tv-disconnect','save-conflict','corrupted-save','storage-full','homebase-sleep','ps5-standby',
 'duplicate-input','stale-input','save-flush-interruption',
] as const);
export interface G28DrillEvidence{drill:string;hardwareObserved:boolean;inputReplayCount:number;orphanedResources:number;saveCorruptions:number;recovered:boolean;artifactRefs:readonly string[];}
export function evaluateG28Drill(e:G28DrillEvidence){
 const counts=[e.inputReplayCount,e.orphanedResources,e.saveCorruptions];
 return{passed:e.hardwareObserved&&e.artifactRefs.length>0&&e.artifactRefs.every(ref=>ref.trim().length>0)&&counts.every(n=>Number.isInteger(n)&&n===0)&&e.recovered};
}
export interface G28SoakEvidence{hardwareObserved:boolean;durationMinutes:number;sessionsStarted:number;sessionsStopped:number;orphanedResources:number;inputIntegrityErrors:number;saveCorruptions:number;unrecoveredCrashes:number;artifactRefs:readonly string[];}
export function evaluateG28Soak(e:G28SoakEvidence){const reasons:string[]=[];
 if(!e.artifactRefs.length||e.artifactRefs.some(ref=>!ref.trim()))reasons.push('artifact-receipts');
 if(![e.durationMinutes,e.sessionsStarted,e.sessionsStopped,e.orphanedResources,e.inputIntegrityErrors,e.saveCorruptions,e.unrecoveredCrashes].every(Number.isFinite))reasons.push('non-finite-evidence');if(!e.hardwareObserved)reasons.push('hardware-evidence-missing');if(e.durationMinutes<240)reasons.push('duration');if(e.sessionsStarted<20)reasons.push('cycles');if(e.sessionsStarted!==e.sessionsStopped)reasons.push('session-leak');if(e.orphanedResources)reasons.push('orphans');if(e.inputIntegrityErrors)reasons.push('input-integrity');if(e.saveCorruptions)reasons.push('save-corruption');if(e.unrecoveredCrashes)reasons.push('unrecovered-crash');return{passed:reasons.length===0,reasons};}
