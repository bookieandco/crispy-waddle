import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { DiagnosticEvidenceBus, GovernedSubsystemDoctorRuntime, SubsystemDoctor, buildRepairReceipt, proveCommandExecuted, routeDoctorIntent, type RepairReceipt } from './subsystem-doctor.js';

const failing=[{source:'test' as const,subsystemId:'fixture',passed:false,summary:'fixture mismatch',provenance:'local-test'},
 {source:'ci' as const,subsystemId:'fixture',passed:false,summary:'fixture mismatch',provenance:'github-actions'}];

describe('BUILDER.2R production repair pass',()=>{
 it('2R.1 never self-authorizes code evolution',()=>{
  const d=new SubsystemDoctor(),h=d.diagnose('fixture',failing);
  const p=d.plan({hypothesis:h,allowedPaths:['/fixtures/builder-doctor'],targetedTests:['test:fixture'],regressionTests:[],securityChecks:[],risk:'low',baseCommit:'abc'});
  assert.equal(p.execution.requiresApproval,true); assert.equal(p.authorizationCapability,'evolution.propose');
 });
 it('2R.2 collects provenance-bearing evidence',async()=>{
  const bus=new DiagnosticEvidenceBus([{collect:async()=>failing}]); assert.equal((await bus.collect('fixture')).length,2);
 });
 it('2R.3 requires corroboration from distinct sources',()=>{
  const d=new SubsystemDoctor(); assert.equal(d.diagnose('fixture',[failing[0]!]).confirmed,false); assert.equal(d.diagnose('fixture',failing).confirmed,true);
 });
 it('2R.4 proves tests actually executed rather than trusting exit zero',()=>{
  assert.equal(proveCommandExecuted({command:'pnpm test',passed:true,discovered:0,executed:0}),false);
  assert.equal(proveCommandExecuted({command:'pnpm test',passed:true,discovered:2,executed:2}),true);
 });
 it('2R.5/6 produces governed plan with known-good recovery point',()=>{
  const d=new SubsystemDoctor(),h=d.diagnose('fixture',failing);
  const p=d.plan({hypothesis:h,allowedPaths:['/fixtures/builder-doctor'],targetedTests:['test:fixture'],regressionTests:['test:dependent'],securityChecks:['protected-paths'],risk:'low',baseCommit:'abc'});
  assert.deepEqual(p.recovery,{baseCommit:'abc',strategy:'discard-isolated-branch'}); assert.deepEqual(p.execution.testCommands,['test:fixture','test:dependent']);
 });
 it('2R.7 fails receipt when a command reports success but ran no tests',()=>{
  const d=new SubsystemDoctor(),h=d.diagnose('fixture',failing),p=d.plan({hypothesis:h,allowedPaths:['/fixtures/builder-doctor'],targetedTests:['test:fixture'],regressionTests:[],securityChecks:[],risk:'low',baseCommit:'abc'});
  const r=buildRepairReceipt(p,{changedFiles:['fixture.ts'],targeted:[{command:'test:fixture',passed:true,discovered:0,executed:0}],regressions:[],securityChecks:[],protectedPathsVerified:true,draftPr:null,commit:null});
  assert.equal(r.status,'FAILED');
 });
 it('2R.8 records both failed and verified repair outcomes for governed learning',async()=>{
  const recorded:RepairReceipt[]=[];
  const runtime=new GovernedSubsystemDoctorRuntime(new DiagnosticEvidenceBus([{collect:async()=>failing}]),new SubsystemDoctor(),{execute:async()=>({changedFiles:['fixture.ts'],targeted:[{command:'test:fixture',passed:false,discovered:1,executed:1}],regressions:[],securityChecks:[],protectedPathsVerified:true,draftPr:null,commit:null})},{record:async r=>{recorded.push(r)}});
  const r=await runtime.repair({subsystemId:'fixture',allowedPaths:['/fixtures/builder-doctor'],targetedTests:['test:fixture'],regressionTests:[],securityChecks:[],risk:'low',baseCommit:'abc',approved:true});
  assert.equal(r.status,'FAILED'); assert.equal(recorded.length,1);
 });
 it('2R.9 routes conversational diagnosis and repair intents',()=>{
  assert.equal(routeDoctorIntent("why is Money Core broken?"),'diagnose_subsystem');
  assert.equal(routeDoctorIntent("fix Opportunity Core"),'propose_repair');
 });
 it('2R.10 completes controlled diagnose→approve→execute→verify→receipt→learning drill',async()=>{
  const learned:RepairReceipt[]=[];
  const runtime=new GovernedSubsystemDoctorRuntime(new DiagnosticEvidenceBus([{collect:async()=>failing}]),new SubsystemDoctor(),{execute:async plan=>({
   changedFiles:['fixtures/builder-doctor/value.ts'],
   targeted:[{command:plan.execution.testCommands[0]!,passed:true,discovered:1,executed:1}],
   regressions:[{command:'test:dependent',passed:true,discovered:1,executed:1}],
   securityChecks:[{command:'protected-paths',passed:true,discovered:1,executed:1}],
   protectedPathsVerified:true,draftPr:'https://example.invalid/pr/fixture',commit:'repair-commit'
  })},{record:async r=>{learned.push(r)}});
  await assert.rejects(()=>runtime.repair({subsystemId:'fixture',allowedPaths:['/fixtures/builder-doctor'],targetedTests:['test:fixture'],regressionTests:['test:dependent'],securityChecks:['protected-paths'],risk:'low',baseCommit:'known-good',approved:false}),/Security Core approval/);
  const receipt=await runtime.repair({subsystemId:'fixture',allowedPaths:['/fixtures/builder-doctor'],targetedTests:['test:fixture'],regressionTests:['test:dependent'],securityChecks:['protected-paths'],risk:'low',baseCommit:'known-good',approved:true});
  assert.equal(receipt.status,'VERIFIED'); assert.equal(receipt.recovery.baseCommit,'known-good'); assert.equal(learned.length,1);
 });
});
