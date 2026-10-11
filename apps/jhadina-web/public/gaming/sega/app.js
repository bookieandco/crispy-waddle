/* Phone-local Sega cartridge library. No network or cartridge uploads. */
(function(){
'use strict';
const DB='jhadina-game-core-v1', STORE='records';
const $=id=>document.getElementById(id);
function report(value){$('status').textContent=value}
function openDb(){return new Promise((resolve,reject)=>{
 const req=indexedDB.open(DB,1);
 req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'key'})};
 req.onsuccess=()=>resolve(req.result);
 req.onerror=()=>reject(req.error||Error('Local storage unavailable'));
 req.onblocked=()=>reject(Error('Close other game tabs and retry'));
})}
async function importLocal(rom){
 const db=await openDb(),id='gen-'+rom.sha256.slice(0,24);
 const romKey='genrom:'+encodeURIComponent(id),libraryKey='library:'+encodeURIComponent(id);
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
  let failure;
  tx.oncomplete=()=>resolve(id);
  tx.onabort=()=>reject(failure||tx.error||Error('Import rolled back'));
  tx.onerror=()=>reject(tx.error||Error('Import failed'));
  const request=store.get(romKey);
  request.onsuccess=()=>{
   if(request.result){
    if(request.result.payload?.sha256!==rom.sha256){failure=Error('ROM SHA-256 collision');tx.abort()}
    return; // Idempotent import: preserve existing library and save revisions.
   }
   store.add({key:romKey,revision:1,payload:{
    gameId:id,sha256:rom.sha256,bytes:rom.bytes,importedAtMs:Date.now()
   }});
   store.add({key:libraryKey,revision:1,payload:{
    id,title:rom.title,platform:'genesis',contentUri:'genesis-local://'+id,
    installed:true,tags:['user-provided'],metadata:{
     sha256:rom.sha256,originalName:rom.name,size:rom.size,region:rom.region
    }
   }});
  };
 })}finally{db.close()}}
async function refresh(){
 const db=await openDb();let records;
 try{records=await new Promise((resolve,reject)=>{
  const req=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Cannot read game library'));
 })}finally{db.close()}
 const library=records.filter(row=>typeof row.key==='string'&&row.key.startsWith('library:')
  &&row.payload?.platform==='genesis'&&row.payload?.contentUri?.startsWith('genesis-local://'));
 $('games').replaceChildren();
 if(!library.length){const li=document.createElement('li');li.textContent='No Sega cartridges installed locally.';$('games').append(li)}
 for(const item of library){
  const li=document.createElement('li'),title=document.createElement('strong');
  title.textContent=item.payload.title;li.append(title);
  const info=document.createElement('small');
  info.textContent=' · '+Number(item.payload.metadata?.size||0).toLocaleString()+' bytes · Play pending';
  li.append(info);$('games').append(li);
 }
}
$('cartridge').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  report('Inspecting ZIP, cartridge header and fingerprint locally…');
  const cartridge=await window.JhadinaSegaCartridge.importCartridge(file);
  await importLocal(cartridge);await refresh();
  $('display').textContent=cartridge.title;
  report(cartridge.title+' verified and imported ('+cartridge.size.toLocaleString()+' bytes). Sega runtime not yet installed; Play remains disabled.');
 }catch(error){report('Import blocked: '+String(error.message||error))}
 finally{event.target.value=''}
});
$('storage').addEventListener('click',async()=>{
 try{
  if(!navigator.storage?.persist)throw Error('Persistent storage request not supported here');
  const granted=await navigator.storage.persist();
  report(granted?'Persistent browser storage granted; keep independent save backups.':'Storage persistence not granted. Keep independent save backups.');
 }catch(error){report(String(error.message||error))}
});
refresh().catch(error=>report('Library unavailable: '+String(error.message||error)));
})();
