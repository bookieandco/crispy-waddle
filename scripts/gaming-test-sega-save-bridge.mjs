import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('apps/jhadina-web/public/gaming/sega/vendor/js/idb.js','utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const romSha='c'.repeat(64),gameId='gen-'+romSha.slice(0,24),romFileName=gameId+'.md';
const logs=[],session={gameId,romSha,romFileName,saveRevision:0,saveQueue:Promise.resolve(),stopped:false};
let stored=null;
globalThis.window={JhadinaSegaActive:session,JhadinaSegaSram:{
 read:async({gameId:id,romSha:hash})=>{
  assert.equal(id,gameId);assert.equal(hash,romSha);return stored;
 },
 write:async({gameId:id,romSha:hash,bytes,expectedRevision})=>{
  assert.equal(id,gameId);assert.equal(hash,romSha);
  assert.equal(expectedRevision,stored?.revision||0);
  const revision=expectedRevision+1;
  stored={revision,bytes:bytes.slice()};
  logs.push([...bytes]);
  return {revision};
 }
}};
assert.deepEqual(await mod.loadSaveFiles(romFileName),{});
const bytes=new Uint8Array([1,2,3,4]);
const a=mod.writeSaveFile(romFileName,'sav',bytes);
bytes[0]=88;
const b=mod.writeSaveFile(romFileName,'sav',new Uint8Array([4,3,2,1]));
await Promise.all([a,b]);
assert.deepEqual(logs,[[1,2,3,4],[4,3,2,1]]);
assert.equal(session.saveRevision,2);
const loaded=await mod.loadSaveFiles(romFileName);
assert.deepEqual([...loaded.sav],[4,3,2,1]);
loaded.sav[0]=99;
assert.equal(stored.bytes[0],4,'Save bytes must be copied on read');
await assert.rejects(()=>mod.writeSaveFile(romFileName,'state',new Uint8Array([5])),/Unapproved/);
await assert.rejects(()=>mod.writeSaveFile('unrelated.md','sav',new Uint8Array([5])),/not bound/);
await assert.rejects(()=>mod.writeBios('genesis',new Uint8Array([1])),/not supported/);
assert.equal(await mod.loadBios('genesis'),null);
session.stopped=true;
await assert.rejects(()=>mod.loadSaveFiles(romFileName),/not bound/);
console.log('PASS: Jgenesis IDB bridge serialized SRAM revisions, copies, owner ROM binding and firmware/save-state denials');
