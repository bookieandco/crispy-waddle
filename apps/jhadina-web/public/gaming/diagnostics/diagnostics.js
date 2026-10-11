/* Local-only physical controls acceptance: nothing is sent to a server. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const startedAt=new Date().toISOString();
const results={storage:'not-tested',crypto:'not-tested',touch:'not-tested',gamepad:'not-tested'};
const checks=[];
let lastPadCount=0,pointerCount=0;
const message=text=>{$('message').textContent=text;};
function update(){
 const portrait=window.matchMedia('(orientation:portrait)').matches;
 $('orientation').textContent=portrait?'Portrait — rotate sideways for games':'Landscape';
 $('env').textContent=(window.isSecureContext?'Secure browser context':'Insecure browser context')+' · '+(typeof indexedDB!=='undefined'?'IndexedDB available':'IndexedDB unavailable')+' · '+(window.crypto?.subtle?'WebCrypto available':'WebCrypto unavailable');
 $('summary').textContent=Object.entries(results).map(([k,v])=>k+': '+v).join(' · ');
}
function record(name,result){
 results[name]=result;
 checks.push({test:name,outcome:result,recordedAt:new Date().toISOString()});
 update();
}
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB request failed'));});}
function transaction(tx){
 return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed'));});
}
async function testIndexedDb(){
 if(!window.indexedDB)throw Error('IndexedDB is unavailable');
 const dbName='jhadina-gaming-diagnostic-synthetic-v1';
 const open=window.indexedDB.open(dbName,1);
 open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains('canary'))open.result.createObjectStore('canary');};
 const db=await request(open);
 const value='synthetic-'+Date.now();
 try{
  const tx=db.transaction('canary','readwrite');
  tx.objectStore('canary').put(value,'roundtrip');
  await transaction(tx);
  const read=db.transaction('canary','readonly');
  const output=await request(read.objectStore('canary').get('roundtrip'));
  if(output!==value)throw Error('IndexedDB value mismatch');
  const clean=db.transaction('canary','readwrite');
  clean.objectStore('canary').delete('roundtrip');
  await transaction(clean);
 }finally{db.close();}
}
async function testEncryption(){
 if(!window.crypto?.subtle)throw Error('WebCrypto unavailable');
 const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 const nonce=crypto.getRandomValues(new Uint8Array(12));
 const input=new TextEncoder().encode('synthetic-jhadina-game-check');
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,input);
 const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},key,ciphertext);
 if(new TextDecoder().decode(plaintext)!=='synthetic-jhadina-game-check')throw Error('AES-GCM round-trip failed');
}
$('testStorage').addEventListener('click',async()=>{
 $('storage').textContent='Testing…';
 try{await testIndexedDb();record('storage','pass');$('storage').textContent='Pass — synthetic write, read, cleanup';}
 catch(e){record('storage','fail');$('storage').textContent='Failed — '+String(e.message||e);}
});
$('testCrypto').addEventListener('click',async()=>{
 $('crypto').textContent='Testing…';
 try{await testEncryption();record('crypto','pass');$('crypto').textContent='Pass — temporary AES-256-GCM encrypt/decrypt';}
 catch(e){record('crypto','fail');$('crypto').textContent='Failed — '+String(e.message||e);}
});
const target=$('touchTarget');
target.addEventListener('pointerdown',event=>{
 if(!event.isTrusted)return;
 pointerCount++;
 target.classList.add('pressed');
 target.textContent='Input received';
 $('touchResult').textContent=event.pointerType+' event received · count '+pointerCount;
 record('touch','pass');
});
for(const evt of ['pointerup','pointercancel','pointerleave'])target.addEventListener(evt,()=>target.classList.remove('pressed'));
function gamepadCheck(){
 if(typeof navigator.getGamepads!=='function'){
  record('gamepad','unsupported');$('gamepad').textContent='Gamepad API unsupported by this browser';return;
 }
 const connected=Array.from(navigator.getGamepads()).filter(p=>p?.connected);
 lastPadCount=connected.length;
 const pressed=connected.some(p=>p.buttons.some(b=>b.pressed));
 const result=pressed?'pass':connected.length?'connected-needs-button':'not-connected';
 record('gamepad',result);
 $('gamepad').textContent=pressed?'Controller button registered':connected.length+' controller(s) connected — press a button and check again';
}
$('testGamepad').addEventListener('click',gamepadCheck);
addEventListener('gamepadconnected',()=>{$('gamepad').textContent='Controller detected. Press a button and tap Check.'});
addEventListener('gamepaddisconnected',()=>{$('gamepad').textContent='Controller disconnected. Recheck.';record('gamepad','disconnected')});
addEventListener('orientationchange',update);
$('reset').addEventListener('click',()=>{
 for(const key of Object.keys(results))results[key]='not-tested';
 checks.length=0;pointerCount=0;lastPadCount=0;
 $('storage').textContent='Not tested';$('crypto').textContent='Not tested';
 $('touchResult').textContent='No real input captured';$('gamepad').textContent='Not tested';
 message('All on-screen results cleared. No gameplay data or original backups were touched.');update();
});
$('download').addEventListener('click',()=>{
 const report={
  schema:'jhadina.gaming.device-check.v1',classification:'local-manual-hardware-evidence-not-production-certification',
  startedAt,exportedAt:new Date().toISOString(),
  secureContext:window.isSecureContext===true,
  orientation:window.matchMedia('(orientation:portrait)').matches?'portrait':'landscape',
  results:{...results},checks:[...checks],
  exclusions:['no-game-contents','no-personal-data','no-controller-identifiers','no-emulator-runtime-certification'],
 };
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='jhadina-game-device-check-'+new Date().toISOString().slice(0,10)+'.json';
 a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 message('Receipt downloaded locally. Review before uploading to the Jhadina Game Core Backups Drive folder.');
});
update();
})();
