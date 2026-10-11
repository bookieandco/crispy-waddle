import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {runInNewContext,Script} from 'node:vm';
const src=readFileSync('apps/jhadina-web/public/gaming/sega/states.js','utf8');
new Script(src,{filename:'states.js'});
const copy=value=>structuredClone(value);
class DB{
 constructor(){this.rows=new Map()}
 close(){}
 transaction(name,mode){
  assert.equal(name,'records');
  const local=new Map([...this.rows].map(([k,v])=>[k,copy(v)]));
  let pending=[],running=false,done=false,aborted=false;
  const tx={oncomplete:null,onerror:null,onabort:null,error:null,
   abort(){if(done||aborted)return;aborted=true;pending=[];queueMicrotask(()=>tx.onabort?.())},
   objectStore:()=>({
    get:key=>{const req={result:undefined,onsuccess:null,onerror:null};
     enqueue(()=>{req.result=local.has(key)?copy(local.get(key)):undefined;req.onsuccess?.()});return req},
    put:row=>{enqueue(()=>local.set(row.key,copy(row)));return{}}
   })
  };
  function enqueue(fn){if(done||aborted)throw Error('closed IDB transaction');pending.push(fn);if(!running){running=true;queueMicrotask(drain)}}
  const db=this;
  function drain(){if(aborted)return;const next=pending.shift();
   if(next){next();if(!aborted)queueMicrotask(drain);return}
   queueMicrotask(()=>{if(aborted)return;if(pending.length){queueMicrotask(drain);return}
    done=true;if(mode==='readwrite')db.rows=local;tx.oncomplete?.()});
  }
  return tx;
 }
}
const db=new DB();
const root={Uint8Array,Date,crypto:webcrypto,indexedDB:{open:()=>{
 const req={result:db,onsuccess:null,onerror:null,onblocked:null,onupgradeneeded:null};
 queueMicrotask(()=>req.onsuccess?.());return req;
}}};
runInNewContext(src,root);
const state=root.JhadinaSegaStates,romSha='b'.repeat(64),gameId='gen-'+romSha.slice(0,24);
const bytes=new Uint8Array(1024).map((_,i)=>i&255);
assert.equal(await state.read({gameId,romSha}),null);
await assert.rejects(()=>state.write({gameId,romSha,bytes,expectedRevision:0}),/ROM missing/);
db.rows.set('genrom:'+gameId,{key:'genrom:'+gameId,revision:1,payload:{sha256:romSha}});
const a=await state.write({gameId,romSha,bytes,expectedRevision:0});
assert.equal(a.revision,1);assert.equal(a.size,1024);
const first=await state.read({gameId,romSha});assert.equal(first.revision,1);
assert.deepEqual([...first.bytes],[...bytes]);
first.bytes[0]=99;
assert.equal((await state.read({gameId,romSha})).bytes[0],0);
await assert.rejects(()=>state.write({gameId,romSha,bytes,expectedRevision:0}),/revision changed/);
const second=await state.write({gameId,romSha,bytes,expectedRevision:1});
assert.equal(second.revision,2);
const modified=db.rows.get('genstate:'+gameId);
modified.payload.bytes[4]^=1;
await assert.rejects(()=>state.read({gameId,romSha}),/SHA-256 mismatch/);
await assert.rejects(()=>state.read({gameId:'gen-invalid',romSha}),/Invalid save-state cartridge/);
await assert.rejects(()=>state.write({gameId,romSha,bytes:new Uint8Array(4),expectedRevision:2}),/size outside/);
modified.payload.bytes[4]^=1;
modified.payload.sourceCommit='other-version';
await assert.rejects(()=>state.read({gameId,romSha}),/metadata does not match/);
console.log('PASS: ROM-bound Genesis snapshot CAS, digest, version fence, no-ROM denial and copy isolation');
