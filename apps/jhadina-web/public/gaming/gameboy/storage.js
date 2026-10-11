/* A single database transaction makes restore collision-safe across open gaming tabs.
 * No credentials, network access, ROM bytes, or server integration. */
(function(global){
'use strict';
const DB='jhadina-game-core-v1';
const STORE='records';
const PREFIXES=['library:','gbstate:','gbram:','save:','session:','observation:','route:','arcade:'];
const MAX_RECORDS=5000;
function openDb(){
 return new Promise((resolve,reject)=>{
  if(!global.indexedDB)return reject(new Error('IndexedDB is not available'));
  const req=global.indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{
   if(!req.result.objectStoreNames.contains(STORE))
    req.result.createObjectStore(STORE,{keyPath:'key'});
  };
  req.onsuccess=()=>{
   const db=req.result;
   db.onversionchange=()=>db.close();
   resolve(db);
  };
  req.onerror=()=>reject(req.error||new Error('Cannot open game storage'));
  req.onblocked=()=>reject(new Error('Close other gaming tabs and retry'));
 });
}
function checkRecords(records){
 if(!Array.isArray(records)||records.length>MAX_RECORDS)throw new Error('Invalid restore record count');
 const seen=new Set();
 for(const row of records){
  if(!row||typeof row.key!=='string'||row.key.length>400
   ||!PREFIXES.some(p=>row.key.startsWith(p))||seen.has(row.key)
   ||!Number.isSafeInteger(row.revision)||row.revision<1
   ||!row.payload||typeof row.payload!=='object')
   throw new Error('Invalid or duplicate restore record');
  seen.add(row.key);
 }
}
function snapshotInto(db){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly');
  const req=tx.objectStore(STORE).getAll();
  let records=[];
  tx.oncomplete=()=>resolve(records);
  tx.onerror=()=>reject(tx.error||new Error('Game backup snapshot failed'));
  tx.onabort=()=>reject(tx.error||new Error('Game backup snapshot aborted'));
  req.onsuccess=()=>{
   records=req.result.filter(r=>typeof r?.key==='string'&&PREFIXES.some(p=>r.key.startsWith(p)));
   if(records.length>MAX_RECORDS){tx.abort();return;}
   records.sort((a,b)=>a.key.localeCompare(b.key));
  };
 });
}
/**
 * Restores with one serializable IDB readwrite transaction. A collision or write
 * error aborts all writes; it preserves the imported revision exactly.
 * Exported for controlled adapter tests with a fake IDBDatabase.
 */
function restoreInto(db,records){
 checkRecords(records);
 if(records.length===0)return Promise.resolve(0);
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');
  const store=tx.objectStore(STORE);
  let i=0,conflict;
  tx.oncomplete=()=>resolve(records.length);
  tx.onabort=()=>reject(conflict||tx.error||new Error('Gaming restore rolled back'));
  tx.onerror=()=>reject(tx.error||new Error('Gaming restore failed'));
  function next(){
   if(i>=records.length)return;
   const record=records[i++];
   const request=store.get(record.key);
   request.onsuccess=()=>{
    if(request.result!==undefined){
     conflict=new Error('Existing gaming data conflicts with this backup; no records restored');
     tx.abort();
     return;
    }
    // The next read and write are queued in this same active transaction.
    // Preserve the exact revision used by subsequent compare-and-swap writes.
    store.add({key:record.key,revision:record.revision,payload:record.payload});
    next();
   };
  }
  next();
 });
}
async function snapshot(){
 const db=await openDb();
 try{return await snapshotInto(db);}finally{db.close();}
}
async function restoreAtomic(records){
 checkRecords(records);
 const db=await openDb();
 try{return await restoreInto(db,records);}finally{db.close();}
}
global.JhadinaGameStorage=Object.freeze({snapshot,restoreAtomic,restoreInto,snapshotInto});
})(window);
