/* Device-private Jgenesis Genesis save-state slot. NO ROM BYTES.
 * One ROM-bound, SHA-reviewed, compare-and-swap record per cartridge.
 */
(function(root){
'use strict';
const DB='jhadina-game-core-v1',STORE='records';
const MAX=8*1024*1024;
const PIN='220421984e710758cb691dcd1dd6a757ae9aca72';
const FORMAT='jhadina.sega.jgenesis.save-state.v1';
const ID=/^gen-[0-9a-f]{24}$/,SHA=/^[0-9a-f]{64}$/;
function validate(gameId,romSha){
 if(!ID.test(gameId)||!SHA.test(romSha)||gameId!=='gen-'+romSha.slice(0,24))
  throw Error('Invalid save-state cartridge identity');
}
function copy(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<64||bytes.byteLength>MAX)
  throw Error('Genesis save-state size outside allowed range');
 return bytes.slice();
}
function key(gameId){return 'genstate:'+encodeURIComponent(gameId)}
async function digest(bytes){
 return [...new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes))]
 .map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function open(){
 return new Promise((resolve,reject)=>{
  if(!root.indexedDB)return reject(Error('IndexedDB unavailable'));
  const r=root.indexedDB.open(DB,1);
  r.onupgradeneeded=()=>{
   if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'key'});
  };
  r.onsuccess=()=>resolve(r.result);
  r.onerror=()=>reject(r.error||Error('Game storage unavailable'));
  r.onblocked=()=>reject(Error('Close competing gaming tabs'));
 });
}
async function read({gameId,romSha}){
 validate(gameId,romSha);
 const db=await open();
 let row;
 try{row=await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key(gameId));
  r.onsuccess=()=>resolve(r.result||null);
  r.onerror=()=>reject(r.error||Error('State read failed'));
  tx.onabort=()=>reject(tx.error||Error('State read aborted'));
 })}finally{db.close()}
 if(!row)return null;
 const p=row.payload;
 if(!Number.isSafeInteger(row.revision)||row.revision<1||
    p?.gameId!==gameId||p?.romSha!==romSha||p?.format!==FORMAT||
    p?.sourceCommit!==PIN||!SHA.test(p?.sha256||''))
  throw Error('Save-state metadata does not match the active cartridge and emulator');
 const bytes=copy(p.bytes);
 if(await digest(bytes)!==p.sha256)throw Error('Save-state SHA-256 mismatch');
 return {revision:row.revision,bytes,sha256:p.sha256,createdAtMs:p.createdAtMs};
}
async function write({gameId,romSha,bytes,expectedRevision}){
 validate(gameId,romSha);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('Explicit state revision required');
 const owned=copy(bytes),sha256=await digest(owned),db=await open();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
  let result,failed;
  tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(tx.error||Error('State transaction failed'));
  tx.onabort=()=>reject(failed||tx.error||Error('State write rolled back'));
  const rom=store.get('genrom:'+encodeURIComponent(gameId));
  rom.onsuccess=()=>{
   if(rom.result?.payload?.sha256!==romSha){
    failed=Error('Verified ROM missing; reimport cartridge before saving state');
    tx.abort();return;
   }
   const old=store.get(key(gameId));
   old.onsuccess=()=>{
    const current=old.result?.revision||0;
    if(current!==expectedRevision){
     failed=Error('Save-state revision changed; refused to overwrite newer progress');
     tx.abort();return;
    }
    result={revision:current+1,sha256,size:owned.byteLength};
    store.put({key:key(gameId),revision:result.revision,payload:{
     gameId,romSha,format:FORMAT,sourceCommit:PIN,sha256,bytes:owned,
     createdAtMs:Date.now()
    }});
   };
  };
 })}finally{db.close()}
}
root.JhadinaSegaStates=Object.freeze({read,write,key,validate,format:FORMAT,sourceCommit:PIN});
})(globalThis);
