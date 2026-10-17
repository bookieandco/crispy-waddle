import {describe,expect,it} from 'vitest';
import {G28_ACCEPTANCE_MATRIX,evaluateG28Case} from './gaming-physical-acceptance.js';
import {buildG28ProductionAcceptanceReport} from './gaming-production-acceptance-report.js';
import {GamingCommissioningHarness} from './gaming-commissioning.js';
import {evaluateG28Drill,evaluateG28Soak} from './gaming-physical-drills.js';
import {evaluateG42Certification,G42_REQUIRED_PATHS} from './gaming-g42-certification.js';

describe('GAME-FINISH physical-evidence fail-closed repair',()=>{
 const c=G28_ACCEPTANCE_MATRIX[0]!;
 const sample={pathId:c.pathId,sampleId:'s',capturedAtMs:1,jhadinaCapturedAtMs:2,runtimeReceivedAtMs:3,frameRenderedAtMs:4,displayedAtMs:5,rttMs:0,jitterMs:0,packetLossPercent:0,reconnectCount:0,orphanedResources:0};
 const receipt={receiptId:'observed-1',pathId:c.pathId,deviceIds:['x5'],firmwareVersions:{x5:'1'},runtimeVersions:{core:'1'},observedByHardware:true,artifactRefs:['sha256:verified'],samples:Array.from({length:20},(_,i)=>({...sample,sampleId:String(i)}))};
 it('rejects duplicate samples even with a hardware claim',()=>{
   const tampered={...receipt,samples:Array.from({length:20},()=>({...sample}))};
   expect(()=>new GamingCommissioningHarness().validate(tampered)).toThrow(/unique/);
   expect(evaluateG28Case(c,{caseId:c.id,receipt:tampered,passedRequirements:c.requirements}).passed).toBe(false);
 });
 it('rejects nonfinite metrics and missing artifacts',()=>{
   expect(evaluateG28Case(c,{caseId:c.id,receipt:{...receipt,samples:receipt.samples.map((s,i)=>i===0?{...s,rttMs:NaN}:s)},passedRequirements:c.requirements}).passed).toBe(false);
   expect(evaluateG28Case(c,{caseId:c.id,receipt:{...receipt,artifactRefs:[]},passedRequirements:c.requirements}).passed).toBe(false);
 });
 it('requires physical drill and soak references',()=>{
   expect(evaluateG28Drill({drill:'wifi-loss',hardwareObserved:true,inputReplayCount:0,orphanedResources:0,saveCorruptions:0,recovered:true,artifactRefs:[]}).passed).toBe(false);
   expect(evaluateG28Soak({hardwareObserved:true,durationMinutes:240,sessionsStarted:20,sessionsStopped:20,orphanedResources:0,inputIntegrityErrors:0,saveCorruptions:0,unrecoveredCrashes:0,artifactRefs:[]}).passed).toBe(false);
 });
 it('cannot accept unverified duplicate case receipts',()=>{
   const result=buildG28ProductionAcceptanceReport({caseEvidence:[{caseId:c.id,receipt,passedRequirements:c.requirements},{caseId:c.id,receipt,passedRequirements:c.requirements}],drillEvidence:[],generatedAtMs:1});
   expect(result.status).toBe('evidence-required');
   expect(result.artifactVerificationPassed).toBe(false);
 });
 it('requires all declared G42 emulator and streaming paths',()=>{
   const evidence=[{evidenceId:'e1',pathId:'local-emulator',kind:'emulator',hardwareObserved:true,artifactRefs:['trace:1'],emulatorReceipt:{measured:true}},{evidenceId:'s1',pathId:'sunshine-lan',kind:'streaming',hardwareObserved:true,artifactRefs:['trace:2'],streamSample:{}}];
   const result=evaluateG42Certification({evidence:evidence as never,soakMinutes:240,sessionCycles:20,orphanedResources:0,inputIntegrityErrors:0,saveCorruptions:0,verifyArtifactRef:()=>true});
   expect(result.status).toBe('evidence-required');
   expect(result.reasons).toContain('missing-route:xbox-cloud');
   expect(G42_REQUIRED_PATHS).toHaveLength(8);
 });
});
