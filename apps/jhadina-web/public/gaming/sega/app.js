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
   const existingRom=request.result;
   const metaRequest=store.get(libraryKey);
   metaRequest.onsuccess=()=>{
    const existingLibrary=metaRequest.result;
    if(existingRom&&existingRom.payload?.sha256!==rom.sha256){
     failure=Error('ROM SHA-256 collision');tx.abort();return;
    }
    if(existingLibrary&&existingLibrary.payload?.metadata?.sha256!==rom.sha256){
     failure=Error('Library metadata fingerprint mismatch');tx.abort();return;
    }
    // A restored save-only backup may contain library metadata but not ROM bytes.
    // Reimport restores the missing ROM without replacing existing metadata revisions.
    if(!existingRom)store.add({key:romKey,revision:1,payload:{
     gameId:id,sha256:rom.sha256,bytes:rom.bytes,importedAtMs:Date.now()
    }});
    if(!existingLibrary)store.add({key:libraryKey,revision:1,payload:{
     id,title:rom.title,platform:'genesis',contentUri:'genesis-local://'+id,
     installed:true,tags:['user-provided'],metadata:{
      sha256:rom.sha256,originalName:rom.name,size:rom.size,region:rom.region
     }
    }});
   };
  };
 })}finally{db.close()}}
async function refresh(){
 const db=await openDb();let records;
 try{records=await new Promise((resolve,reject)=>{
  const req=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('Cannot read game library'));
 })}finally{db.close()}
 const roms=new Map(records.filter(r=>typeof r.key==='string'&&r.key.startsWith('genrom:')).map(r=>[r.key,r.payload]));
 const library=records.filter(row=>typeof row.key==='string'&&row.key.startsWith('library:')
  &&row.payload?.platform==='genesis'&&row.payload?.contentUri?.startsWith('genesis-local://'));
 $('games').replaceChildren();
 if(!library.length){const li=document.createElement('li');li.textContent='No Sega cartridges installed locally.';$('games').append(li)}
 for(const item of library){
  const li=document.createElement('li'),title=document.createElement('strong');
  title.textContent=item.payload.title;li.append(title);
  const info=document.createElement('small');
  const rom=roms.get('genrom:'+encodeURIComponent(item.payload.id));
  const available=rom?.sha256===item.payload.metadata?.sha256&&rom?.bytes?.length===item.payload.metadata?.size;
  info.textContent=' · '+Number(item.payload.metadata?.size||0).toLocaleString()+' bytes · '+(available?'Locally imported · Play pending':'Reimport ROM required');
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
// Landscape player chrome stays mounted while owner opens the game drawer.
const panel=$('libraryPanel');
let previousFocus=null;
function openLibrary(){
 previousFocus=document.activeElement;
 panel.hidden=false;
 $('closeLibrary').focus();
}
function closeLibrary(){
 panel.hidden=true;
 const target=previousFocus;
 previousFocus=null;
 if(target&&typeof target.focus==='function')target.focus();
}
$('openLibrary').addEventListener('click',openLibrary);
$('portraitLibrary').addEventListener('click',openLibrary);
$('closeLibrary').addEventListener('click',closeLibrary);
panel.addEventListener('click',event=>{if(event.target===panel)closeLibrary()});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!panel.hidden){event.preventDefault();closeLibrary()}
 // Focus stays inside the private file drawer when visible.
 if(event.key!=='Tab'||panel.hidden)return;
 const focusable=[...panel.querySelectorAll('button:not([disabled]),label.file,input[type=file]')].filter(
  item=>item.getClientRects().length>0&&item.tabIndex!==-1
 );
 if(!focusable.length)return;
 const first=focusable[0],last=focusable[focusable.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
async function deviceCheck(){
 const output=$('deviceChecklist');
 if(!window.JhadinaSegaDevice){report('Capability checker unavailable');return}
 output.textContent='Checking WebGPU, isolation and browser features locally…';
 try{
  const values=await window.JhadinaSegaDevice.inspect();
  output.textContent=window.JhadinaSegaDevice.summary(values);
  $('runtimeStatus').textContent=values.webGPUAdapter&&values.crossOriginIsolated?
   'Hardware detected · core pending':'Runtime preflight incomplete';
  report('Sega device capability check captured locally. This is not a gameplay test.');
 }catch(error){
  output.textContent='Capability probe failed: '+String(error.message||error);
  report('Sega device check unavailable');
 }
}
$('checkRuntime').addEventListener('click',()=>{openLibrary();deviceCheck()});
$('drawerDeviceCheck').addEventListener('click',deviceCheck);

refresh().catch(error=>report('Library unavailable: '+String(error.message||error)));
})();
