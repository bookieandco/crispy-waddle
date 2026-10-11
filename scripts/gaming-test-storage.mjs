/* Transactional restore regression suite. This uses a deterministic fake IDB
 * transaction scheduler, not an iPhone or production-browser attestation. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';

const global={crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Date,btoa,atob,console,window:{}};
runInNewContext(readFileSync('apps/jhadina-web/public/gaming/gameboy/storage.js','utf8'),global,{filename:'storage.js'});
runInNewContext(readFileSync('apps/jhadina-web/public/gaming/gameboy/backup.js','utf8'),global,{filename:'backup.js'});
const {restoreInto,snapshotInto}=global.window.JhadinaGameStorage;
const {encrypt,decrypt}=global.window.JhadinaGameBackup;
function clone(value){return structuredClone(value);}
class FakeIndexedDb {
 constructor(rows=[],failAddKey=''){this.rows=new Map(rows.map(x=>[x.key,clone(x)]));this.failAddKey=failAddKey;}
 transaction(name,mode){
  assert.equal(name,'records');
  assert(['readonly','readwrite'].includes(mode));
  const working=new Map([...this.rows].map(([k,v])=>[k,clone(v)]));
  const pending=[];
  let draining=false,closed=false,aborted=false;
  const db=this;
  const tx={oncomplete:null,onabort:null,onerror:null,error:null,
   abort(){
    if(closed||aborted)return;
    aborted=true;
    pending.length=0;
    queueMicrotask(()=>{closed=true;tx.onabort?.();});
   },
   objectStore(store){
    assert.equal(store,'records');
    return{
     get(key){
      const req={result:undefined,onsuccess:null};
      schedule(()=>{
       req.result=working.has(key)?clone(working.get(key)):undefined;
       req.onsuccess?.();
      });
      return req;
     },
     getAll(){
      const req={result:undefined,onsuccess:null};
      schedule(()=>{
       req.result=[...working.values()].map(clone);
       req.onsuccess?.();
      });
      return req;
     },
     add(row){
      schedule(()=>{
       if(working.has(row.key)||db.failAddKey===row.key){
        tx.error=new Error('Simulated indexedDB add failed');tx.abort();return;
       }
       working.set(row.key,clone(row));
      });
      return{};
     },
    };
   },
  };
  function schedule(job){
   if(closed||aborted)throw Error('Transaction inactive');
   pending.push(job);
   if(!draining){draining=true;queueMicrotask(drain);}
  }
  function drain(){
   if(aborted)return;
   const job=pending.shift();
   if(job){
    job();
    if(!aborted)queueMicrotask(drain);
    return;
   }
   // A second microtask gives event callbacks a chance to queue the next request.
   queueMicrotask(()=>{
    if(aborted)return;
    if(pending.length){queueMicrotask(drain);return;}
    closed=true;
    if(mode==='readwrite')db.rows=working;
    tx.oncomplete?.();
   });
  }
  return tx;
 }
}
const r1={key:'library:one',revision:4,payload:{id:'one',title:'Homebrew',platform:'gameboy',contentUri:'gameboy-local://one'}};
const r2={key:'arcade:neon-run:best',revision:8,payload:{gameId:'neon-run',score:230,achievedAtMs:171}};
const password='only-a-synthetic-fixture-password';
const archived=await encrypt([r1,r2],password);
const restored=await decrypt(archived,password);
const clean=new FakeIndexedDb();
assert.equal(await restoreInto(clean,restored),2);
assert.equal(clean.rows.get('library:one').revision,4);
assert.equal(clean.rows.get('arcade:neon-run:best').revision,8);
assert.deepEqual((await snapshotInto(clean)).map(x=>x.key),['arcade:neon-run:best','library:one']);
const withROM=new FakeIndexedDb([{key:'rom:local',revision:1,payload:{bytes:new Uint8Array([1])}}]);
assert.deepEqual(await snapshotInto(withROM),[],'never export original cartridge bytes');
const collision=new FakeIndexedDb([r2]);
await assert.rejects(()=>restoreInto(collision,[r1,r2]),/conflicts/);
assert.equal(collision.rows.size,1,'a collision must abort all earlier writes');
assert.equal(collision.rows.has(r1.key),false);
const writeFailure=new FakeIndexedDb([],r2.key);
await assert.rejects(()=>restoreInto(writeFailure,[r1,r2]),/Simulated|rolled back/);
assert.equal(writeFailure.rows.size,0,'a quota/write error must abort all prior writes');
await assert.rejects(async()=>restoreInto(new FakeIndexedDb(),[r1,r1]),/duplicate/);
assert.equal(await restoreInto(new FakeIndexedDb(),[]),0);
console.log('PASS: synthetic encrypted Game Core backup, atomic restore, revisions, collisions, rollback, ROM-free snapshot');
