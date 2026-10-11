import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';

const file='apps/jhadina-web/public/gaming/sega/state-coordinator.js';
const source=readFileSync(file,'utf8');
new Script(source,{filename:file});
const root={Uint8Array};
runInNewContext(source,root,{filename:file});
const makeGate=()=>{let ok,fail;return {
 promise:new Promise((resolve,reject)=>{ok=resolve;fail=reject}),
 resolve:value=>ok(value),reject:err=>fail(err)
}};
const id='gen-'+'e'.repeat(24),romSha='e'.repeat(64);
const bytes=new Uint8Array(128).fill(7);
let writeCalls=[],readCalls=[],captureCalls=0,restoreCalls=0;
let captureGate=null,writeGate=null,readGate=null,restoreGate=null;
let persisted=null;
let session={gameId:id,romSha,stateRevision:0,stopped:false,loaded:false};
const channel={tag:'owner-channel'};
const states={
 write:async args=>{
  writeCalls.push(args);
  assert.equal(args.gameId,id);assert.equal(args.romSha,romSha);
  assert.equal(args.expectedRevision,session.stateRevision);
  if(writeGate)await writeGate.promise;
  persisted={revision:args.expectedRevision+1,bytes:args.bytes.slice()};
  return {revision:persisted.revision,sha256:'f'.repeat(64),size:args.bytes.length};
 },
 read:async args=>{
  readCalls.push(args);
  assert.equal(args.gameId,id);assert.equal(args.romSha,romSha);
  if(readGate)await readGate.promise;
  return persisted;
 }
};
const capture=async passed=>{
 assert.equal(passed,channel);captureCalls++;
 if(captureGate)await captureGate.promise;
 return {bytes};
};
const restore=async(passed,raw)=>{
 assert.equal(passed,channel);assert.deepEqual([...raw],[...bytes]);restoreCalls++;
 if(restoreGate)await restoreGate.promise;
};
const controller=()=>root.JhadinaSegaStateCoordinator.create({session,channel,states,capture,restore});
const c=controller();
await assert.rejects(()=>c.saveState(),/not ready/);
await assert.rejects(()=>c.loadState(),/not ready/);
assert.equal(captureCalls,0);
session.loaded=true;
captureGate=makeGate();
const savePending=c.saveState();
await assert.rejects(()=>c.saveState(),/already running/);
await assert.rejects(()=>c.loadState(),/already running/);
assert.equal(writeCalls.length,0,'No persistence until capture settles');
captureGate.resolve();
await savePending;
captureGate=null;
assert.equal(session.stateRevision,1);
assert.equal(persisted.revision,1);
assert.equal(writeCalls.length,1);

writeGate=makeGate();
const secondSave=c.saveState();
for(let n=0;n<6&&writeCalls.length!==2;n++)await Promise.resolve();
assert.equal(writeCalls.length,2,'Second capture reaches asynchronous state commit');
await assert.rejects(()=>c.loadState(),/already running/,
 'A load must not interleave while IndexedDB write is pending');
await assert.rejects(()=>c.saveState(),/already running/);
writeGate.resolve();
await secondSave;writeGate=null;
assert.equal(session.stateRevision,2,'Revision advances only after committed write');

readGate=makeGate();
const pendingLoad=c.loadState();
await assert.rejects(()=>c.saveState(),/already running/,
 'Save must not interleave while IndexedDB read is pending');
readGate.resolve();
await pendingLoad;readGate=null;
assert.equal(restoreCalls,1);

session.stopped=true;
await assert.rejects(()=>c.saveState(),/not ready/);
session.stopped=false;
captureGate=makeGate();
const abortedCapture=c.saveState();
const priorWrites=writeCalls.length;
session.stopped=true;
captureGate.resolve();
await assert.rejects(()=>abortedCapture,/not ready/);
captureGate=null;
assert.equal(writeCalls.length,priorWrites,'Stopped session must not persist captured state');

session.stopped=false;
readGate=makeGate();
const abortedRestore=c.loadState();
const priorRestores=restoreCalls;
session.loaded=false;
readGate.resolve();
await assert.rejects(()=>abortedRestore,/not ready/);
readGate=null;
assert.equal(restoreCalls,priorRestores,'Unloaded session must not restore stale state');

session.loaded=true;
const successful=await c.saveState();
assert.equal(successful.revision,3,'Operation lock released after earlier rejections');
assert.equal(session.stateRevision,3);
console.log('PASS: Sega save/resume exclusive across WASM callback, IDB commit/read, teardown and denied overlap');
console.log('No ROM, actual Jgenesis engine, iPhone, or browser GPU is used in this isolated regression test.');
