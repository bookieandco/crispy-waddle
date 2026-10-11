import type {EmulatorCompatibilityReceipt} from './emulator-hardening.js';
import type {StreamingNetworkSample} from './gaming-online-streaming.js';
export const G42_REQUIRED_PATHS=Object.freeze([
 'local-emulator','browser-emulator','native-emulator','sunshine-lan',
 'sunshine-internet','playstation-remote','xbox-home','xbox-cloud',
] as const);
export type G42PhysicalPath=typeof G42_REQUIRED_PATHS[number];
export interface G42PhysicalEvidence{
 evidenceId:string;pathId?:G42PhysicalPath;kind:'emulator'|'streaming';
 hardwareObserved:boolean;artifactRefs:readonly string[];
 emulatorReceipt?:EmulatorCompatibilityReceipt;streamSample?:StreamingNetworkSample;
}
export interface G42CertificationInput{
 evidence:readonly G42PhysicalEvidence[];soakMinutes:number;sessionCycles:number;
 orphanedResources:number;inputIntegrityErrors:number;saveCorruptions:number;
 /** Real host must independently verify these refs; default is deny. */
 verifyArtifactRef?:(ref:string)=>boolean;
}
export function evaluateG42Certification(i:G42CertificationInput){
 const physical=i.evidence.filter(e=>e.hardwareObserved&&e.evidenceId.trim()
   &&e.artifactRefs.length>0&&Boolean(i.verifyArtifactRef)
   &&e.artifactRefs.every(ref=>ref.trim().length>0&&i.verifyArtifactRef!(ref)));
 const emulator=physical.some(e=>e.kind==='emulator'&&e.emulatorReceipt?.measured);
 const streaming=physical.some(e=>e.kind==='streaming'&&Boolean(e.streamSample));
 const missing=G42_REQUIRED_PATHS.filter(path=>!physical.some(e=>e.pathId===path));
 const reasons:string[]=[];
 if(!emulator)reasons.push('physical-emulator-evidence');
 if(!streaming)reasons.push('physical-streaming-evidence');
 if(!i.verifyArtifactRef||physical.length!==i.evidence.length)reasons.push('artifact-receipts');
 if(missing.length)reasons.push(...missing.map(path=>`missing-route:${path}`));
 if(!Number.isFinite(i.soakMinutes)||i.soakMinutes<240)reasons.push('soak-duration');
 if(!Number.isFinite(i.sessionCycles)||i.sessionCycles<20)reasons.push('session-cycles');
 if(![i.orphanedResources,i.inputIntegrityErrors,i.saveCorruptions].every(n=>Number.isInteger(n)&&n===0))reasons.push('integrity-counters');
 return{status:reasons.length?'evidence-required' as const:'certified' as const,reasons};
}
