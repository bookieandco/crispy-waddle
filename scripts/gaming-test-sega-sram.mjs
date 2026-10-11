import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {runInNewContext,Script} from 'node:vm';

const source=readFileSync('apps/jhadina-web/public/gaming/sega/sram.js','utf8');
new Script(source,{filename:'sram.js'});
const copy=value=>structuredClone(value);
class Database{
 constructor(){this.rows=new Map()}
 close(){}
 transaction(name,mode){
  assert.equal(name,'records');
  const copyMap=new Map([...this.rows].map(([k,v])=>[k,copy(v)]));
  let pending=[],busy=false,closed=false,abort=false;
  const tx={oncomplete:null,onabort:null,onerror:null,error:null,
   abort(){if(abort||closed)return;abort=true;pending=[];queueMicrotask(()=>tx.onabort?.())},
   objectStore:()=>({
    get:key=>{const req={result:undefined,onsuccess:null,onerror:null};enqueue(()=>{
      req.result=copyMap.has(key)?copy(copyMap.get(key)):undefined;req.onsuccess?.()});return req},
    put:row=>{enqueue(()=>{copyMap.set(row.key,copy(row))});return{}}
   })
  };
  const enqueue=job=>{if(closed||abort)throw Error('Transaction not open');pending.push(job);if(!busy){busy=true;queueMicrotask(drain)}};
  const drain=()=>{
   if(abort)return;
   const job=pending.shift();
   if(job){job();if(!abort)queueMicrotask(drain);return}
   queueMicrotask(()=>{if(abort)return;if(pending.length){queueMicrotask(drain);return}
    closed=true;if(mode==='readwrite')this.rows=copyMap;tx.oncomplete?.()})
  };
  return tx;
 }
}
const db=new Database();
const indexedDB={open:()=>{const req={result:db,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
 queueMicrotask(()=>req.onsuccess?.());return req}};
const root={Uint8Array,Date,crypto:webcrypto,indexedDB};
runInNewContext(source,root);
const vault=root.JhadinaSegaSram;
const romSha='a'.repeat(64),gameId='gen-'+romSha.slice(0,24);
const gameBytes=new Uint8Array([1,2,3,4,5]);
await assert.rejects(()=>vault.write({gameId,romSha,bytes:gameBytes,expectedRevision:0}),/Reimport/);
db.rows.set('genrom:'+gameId,{key:'genrom:'+gameId,revision:1,payload:{sha256:romSha,bytes:new Uint8Array([6])}});
assert.equal(await vault.read({gameId,romSha}),null);
const saved=await vault.write({gameId,romSha,bytes:gameBytes,expectedRevision:0});
assert.equal(saved.revision,1);
assert.equal(saved.size,5);
const restored=await vault.read({gameId,romSha});
assert.deepEqual([...restored.bytes],[1,2,3,4,5]);
gameBytes[0]=99;
assert.deepEqual([...((await vault.read({gameId,romSha})).bytes)],[1,2,3,4,5],'caller modifications cannot overwrite saved bytes');
await assert.rejects(()=>vault.write({gameId,romSha,bytes:new Uint8Array([8]),expectedRevision:0}),/revision changed/);
assert.deepEqual([...((await vault.read({gameId,romSha})).bytes)],[1,2,3,4,5],'stale save must not overwrite');
const modified=db.rows.get('gensram:'+gameId);
modified.payload.bytes[0]=77;
await assert.rejects(()=>vault.read({gameId,romSha}),/SHA-256 mismatch/);
await assert.rejects(()=>vault.write({gameId:'gen-invalid',romSha,bytes:new Uint8Array([1]),expectedRevision:0}),/Invalid Sega/);
await assert.rejects(()=>vault.write({gameId,romSha,bytes:new Uint8Array(0),expectedRevision:0}),/SRAM/);
console.log('PASS: Sega SRAM write/read, cartridge binding, revision CAS, copy isolation, tamper denial and missing ROM gate');
