/* Genesis SRAM vault. Owned data only; no cartridge bytes in save records.
 * Uses the shared Game Core IndexedDB transaction/revision model.
 */
(function(root){
'use strict';
const DB='jhadina-game-core-v1',STORE='records',MAX=2*1024*1024;
const ID=/^gen-[0-9a-f]{24}$/,SHA=/^[0-9a-f]{64}$/;
function validGame(gameId,romSha){
 if(!ID.test(gameId)||!SHA.test(romSha)||gameId!=='gen-'+romSha.slice(0,24))
  throw new Error('Invalid Sega cartridge identity');
}
function copyBytes(value){
 if(!(value instanceof Uint8Array)||value.length<1||value.length>MAX)
  throw new Error('SRAM must contain 1 byte to 2 MiB');
 return value.slice();
}
function open(){
 return new Promise((resolve,reject)=>{
  if(!root.indexedDB)return reject(new Error('Local storage unavailable'));
  const request=root.indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{
   if(!request.result.objectStoreNames.contains(STORE))
    request.result.createObjectStore(STORE,{keyPath:'key'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Cannot open Sega SRAM storage'));
  request.onblocked=()=>reject(new Error('Close other game tabs and retry'));
 });
}
async function hash(bytes){
 const digest=await root.crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function key(gameId){return 'gensram:'+encodeURIComponent(gameId)}
async function read({gameId,romSha}){
 validGame(gameId,romSha);
 const db=await open();
 let record;
 try{record=await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),store=tx.objectStore(STORE);
  const r=store.get(key(gameId));
  r.onsuccess=()=>resolve(r.result||null);
  r.onerror=()=>reject(r.error||new Error('SRAM read failed'));
  tx.onabort=()=>reject(tx.error||new Error('SRAM transaction aborted'));
 })}finally{db.close()}
 if(!record)return null;
 if(!Number.isSafeInteger(record.revision)||record.revision<1
    ||record.payload?.gameId!==gameId||record.payload?.romSha!==romSha
    ||!SHA.test(record.payload?.sha256||''))
  throw new Error('SRAM metadata does not match cartridge');
 const bytes=copyBytes(record.payload.bytes);
 if(await hash(bytes)!==record.payload.sha256)throw new Error('SRAM SHA-256 mismatch');
 return {revision:record.revision,bytes,sha256:record.payload.sha256};
}
async function write({gameId,romSha,bytes,expectedRevision}){
 validGame(gameId,romSha);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
  throw new Error('Explicit SRAM revision required');
 const saved=copyBytes(bytes),sha256=await hash(saved);
 const db=await open();
 try{return await new Promise((resolve,reject)=>{
  let result,failed;
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
  tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(tx.error||new Error('SRAM write failed'));
  tx.onabort=()=>reject(failed||tx.error||new Error('SRAM write rolled back'));
  const romRequest=store.get('genrom:'+encodeURIComponent(gameId));
  romRequest.onsuccess=()=>{
   if(romRequest.result?.payload?.sha256!==romSha){
    failed=new Error('Reimport the verified cartridge before writing SRAM');tx.abort();return;
   }
   const request=store.get(key(gameId));
   request.onsuccess=()=>{
    const current=request.result?.revision||0;
    if(current!==expectedRevision){
     failed=new Error('SRAM revision changed; save rejected to avoid losing progress');tx.abort();return;
    }
    const revision=current+1;
    store.put({key:key(gameId),revision,payload:{
     gameId,romSha,sha256,bytes:saved,format:'jgenesis-sram',updatedAtMs:Date.now()
    }});
    result={revision,sha256,size:saved.length};
   };
  };
 })}finally{db.close()}
}
root.JhadinaSegaSram=Object.freeze({read,write,validGame,key});
})(globalThis);
