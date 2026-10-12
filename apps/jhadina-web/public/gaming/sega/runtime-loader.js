/* SEGA-WASM.3: fail-closed loader of independently approved, self-hosted Jgenesis.
 * Browser never sends game bytes to server. NO binary/approval manifest is bundled.
 * The only accepted package is an operator-reviewed source-bridge build.
 */
(function(root){
'use strict';
const BASE='/gaming/sega/vendor/';
const MANIFEST=BASE+'manifest.approved.json';
const LOCAL_MANIFEST=BASE+'manifest.local-test.json';
const LOCAL_SOURCE_SHA='aca3f2741f8b23da0aaf4433a3cccb78eb0f449696b08f4c748be7dedd2c900d';
const LOCAL_WASM_SHA='2eaf8451759b14b66cf29650bee168dd28842fa0ed92cdf2635ad2d42770f57d';
const PIN='220421984e710758cb691dcd1dd6a757ae9aca72';
const FILES=Object.freeze([
 'pkg/jgenesis_web.js','pkg/jgenesis_web_bg.wasm',
 'js/ui.js','js/idb.js','js/audio-processor.js','js/polyfill.js'
]);
const HEX=/^[0-9a-f]{64}$/;
let attempt=null;
async function sha256(bytes){
 const hash=await root.crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function loadAsset(relative){
 const res=await root.fetch(BASE+relative,{credentials:'same-origin',cache:'no-store',redirect:'error'});
 if(!res.ok||res.type==='opaque')throw Error('Missing approved Sega asset: '+relative);
 return new Uint8Array(await res.arrayBuffer());
}
async function verifyManifest(){
 if(root.location?.protocol!=='https:'&&root.location?.hostname!=='localhost')throw Error('HTTPS required');
 if(!root.isSecureContext||!root.crossOriginIsolated)throw Error('Sega requires HTTPS and route-specific COOP/COEP');
 if(!root.navigator?.gpu?.requestAdapter)throw Error('WebGPU not available');
 const adapter=await root.navigator.gpu.requestAdapter({powerPreference:'low-power'});
 if(!adapter)throw Error('WebGPU adapter unavailable');
 // Independently approved deployments have priority; the *different*
 // owner-imported test path never invents GPL review or operator approval.
 const res=await root.fetch(MANIFEST,{credentials:'same-origin',cache:'no-store',redirect:'error'});
 let manifest,localTest=false;
 if(res.ok){
  manifest=await res.json();
  if(manifest?.schema!=='jhadina.sega.jgenesis.approved.v1'||
     manifest?.sourceCommit!==PIN||manifest?.bridgeApi!=='jhadina.sega.jgenesis.bridge.v1'||
     manifest?.operatorApproved!==true||manifest?.licenseReviewed!==true||
     manifest?.testOnly===true||!manifest.files||typeof manifest.files!=='object')
   throw Error('Sega runtime manifest not independently approved');
 }else{
  if(!root.JhadinaSegaLocalTest||!await root.JhadinaSegaLocalTest.isInstalled())
   throw Error('Approved Sega engine not installed. Owner-only local test package may be imported separately.');
  const local=await root.fetch(LOCAL_MANIFEST,{credentials:'same-origin',cache:'no-store',redirect:'error'});
  if(!local.ok)throw Error('Local owner-test manifest missing');
  manifest=await local.json();localTest=true;
  if(manifest?.schema!=='jhadina.sega.jgenesis.local-test.v1'||
     manifest?.sourceCommit!==PIN||manifest?.bridgeApi!=='jhadina.sega.jgenesis.bridge.v1'||
     manifest?.testOnly!==true||manifest?.localOnly!==true||
     manifest?.operatorApproved!==false||manifest?.licenseReviewed!==false||
     manifest?.sourceReceiptSha256!==LOCAL_SOURCE_SHA||
     manifest?.wasmSha256!==LOCAL_WASM_SHA||
     manifest?.files?.['pkg/jgenesis_web_bg.wasm']!==LOCAL_WASM_SHA)
   throw Error('Untrusted private Sega test package rejected');
 }
 // wasm-bindgen builds source-module imports as JS files inside pkg/snippets.
 // Admit only the hashed files recorded in this reviewed artifact manifest.
 const names=Object.keys(manifest.files).sort();
 const snippets=names.filter(name=>name.startsWith('pkg/snippets/'));
 if(snippets.length<3||snippets.length>20||
    !['ui.js','idb.js','polyfill.js'].every(file=>snippets.some(name=>name.endsWith('/js/'+file)))||
    !snippets.every(name=>/^pkg\/snippets\/[a-zA-Z0-9_./-]+\.js$/.test(name)&&!name.includes('..')&&!name.includes('//'))||
    names.join('|')!==[...FILES,...snippets].sort().join('|'))
  throw Error('Unreviewed generated Jgenesis module set');
 for(const relative of [...FILES,...snippets]){
  const claimed=manifest.files[relative];
  if(!HEX.test(claimed)||await sha256(await loadAsset(relative))!==claimed)
   throw Error('Sega runtime artifact hash mismatch: '+relative);
 }
 return {...manifest,localTest};
}
async function loadApproved(){
 if(!attempt)attempt=(async()=>{
  const verified=await verifyManifest();
  // Assets were content-attested immediately before same-origin JS execution.
  const mod=await import('/gaming/sega/vendor/pkg/jgenesis_web.js');
  for(const key of ['default','run_emulator','WebConfigRef','EmulatorChannel']){
   if(typeof mod[key]!=='function')throw Error('Patched Jgenesis bridge export missing: '+key);
  }
  await mod.default(BASE+'pkg/jgenesis_web_bg.wasm');
  const channel=new mod.EmulatorChannel();
  if(typeof channel.clone!=='function'||typeof channel.request_open_verified_rom!=='function'||
      typeof channel.request_genesis_input!=='function'||
      typeof channel.request_save_genesis_state!=='function'||
      typeof channel.request_load_genesis_state!=='function')
   throw Error('Unpatched Jgenesis WASM rejected');
  return {module:mod,channel,config:new mod.WebConfigRef(),localTest:verified.localTest===true};
 })();
 return attempt;
}
async function readVerifiedCartridge({gameId,romSha}){
 if(!/^gen-[a-f0-9]{24}$/.test(gameId)||!HEX.test(romSha)||gameId!=='gen-'+romSha.slice(0,24))
  throw Error('Invalid Sega cartridge ID');
 return new Promise((resolve,reject)=>{
  const req=root.indexedDB.open('jhadina-game-core-v1',1);
  req.onupgradeneeded=()=>{
   if(!req.result.objectStoreNames.contains('records'))req.result.createObjectStore('records',{keyPath:'key'});
  };
  req.onerror=()=>reject(req.error||Error('Cannot open cartridge library'));
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction('records','readonly');
   const row=tx.objectStore('records').get('genrom:'+encodeURIComponent(gameId));
   row.onerror=()=>reject(row.error||Error('Cannot load game bytes'));
   row.onsuccess=()=>{
    const payload=row.result?.payload;
    if(payload?.sha256!==romSha||!(payload.bytes instanceof Uint8Array)){
     reject(Error('Private ROM missing; reimport it from Files'));return;
    }
    resolve(payload.bytes.slice());
   };
   tx.oncomplete=()=>db.close();
   tx.onabort=()=>{db.close();reject(Error('ROM read aborted'))};
  };
 });
}
let started=false;
let stateCoordinator=null;
let stateInFlight=false;
async function play({gameId,romSha}){
 if(started)throw Error('A Sega game is already running. Reload to change cartridges.');
 const bytes=await readVerifiedCartridge({gameId,romSha});
 if(await sha256(bytes)!==romSha)throw Error('Game cartridge SHA-256 mismatch');
 // The patched Jgenesis source accepts private ROM bytes, not a remote URL.
 const {module,channel,config,localTest}=await loadApproved();
 if(!root.JhadinaSegaInput||!root.JhadinaSegaSram||!root.JhadinaSegaStates||!root.JhadinaSegaStateCoordinator)throw Error('Sega save/input/state modules missing');
 const romFileName=gameId+'.md';
 const state=root.JhadinaSegaStates;
 const existing=await state.read({gameId,romSha});
 const session={gameId,romSha,romFileName,saveQueue:Promise.resolve(),saveRevision:0,
  stateRevision:existing?.revision||0,stopped:false,loaded:false,localTest};
 // Winit appends its WebGPU canvas before emitting runtime-ready. A display:none
 // parent can yield a zero-sized drawing surface on mobile browsers. Allocate
 // layout without revealing an uninitialized frame or enabling controls.
 const container=root.document.getElementById('jgenesis-wasm');
 if(!container)throw Error('Missing Jgenesis rendering mount');
 container.hidden=false;
 container.style.visibility='hidden';
 root.JhadinaSegaActive=session;
 const controls=root.JhadinaSegaInput.create({
  onInput:({button,pressed})=>{
   if(!channel.request_genesis_input(button,pressed))throw Error('Sega input bridge rejected button');
  },
  host:root
 });
 started=true;
 stateCoordinator=root.JhadinaSegaStateCoordinator.create({
  session,channel,states:root.JhadinaSegaStates,
  capture:bridge=>awaitStateEvent('jhadina-sega:state-saved',()=>bridge.request_save_genesis_state()),
  restore:(bridge,bytes)=>awaitStateEvent('jhadina-sega:state-loaded',()=>bridge.request_load_genesis_state(bytes))
 });
 let ready=false;
 let startupPhase='renderer-initializing',startupWatchdog=null;
 const setStartupStatus=message=>{
  const node=root.document.getElementById('runtimeStatus');
  if(node)node.textContent=message;
 };
 const clearStartupWatchdog=()=>{
  if(startupWatchdog!==null){root.clearTimeout(startupWatchdog);startupWatchdog=null;}
 };
 const armStartupWatchdog=()=>{
  clearStartupWatchdog();
  startupWatchdog=root.setTimeout(()=>{
   if(session.loaded||session.stopped)return;
   setStartupStatus(startupPhase==='rom-open-queued'?
    'Sega launch stalled: renderer ready, cartridge load not confirmed':
    'Sega launch stalled: renderer initialization not confirmed');
   root.dispatchEvent(new root.CustomEvent('jhadina-sega:launch-stalled',{
    detail:{stage:startupPhase,waitedMs:20000}
   }));
  },20000);
 };
 const onReady=()=>{
  if(ready||session.stopped)return;ready=true;
  try{
   if(channel.request_open_verified_rom(romFileName,bytes)!==true)
    throw Error('Jgenesis refused the verified cartridge request');
  }catch(error){onError(error);return;}
  startupPhase='rom-open-queued';
  setStartupStatus('Jgenesis renderer ready · cartridge request queued');
  armStartupWatchdog();
 };
 const onLoaded=()=>{
  if(!ready||session.stopped)return;
  clearStartupWatchdog();
  const canvas=container.querySelector('canvas');
  if(!canvas){root.dispatchEvent(new Event('jhadina-sega:runtime-error'));return;}
  try{
   controls.activate();
   session.loaded=true;
   root.document.getElementById('standbyScreen').hidden=true;
   container.style.visibility='visible';
   root.document.getElementById('runtimeStatus').textContent=localTest?
    'Private, owner-imported test · not licensed/production certified':
    'Genesis cartridge loaded · iPhone acceptance pending';
   root.dispatchEvent(new Event('jhadina-sega:gameplay-ready'));
  }catch{onError()}

 };
 const onError=error=>{
  clearStartupWatchdog();
  session.stopped=true;
  session.loaded=false;
  controls.deactivate();
  container.style.visibility='hidden';
  container.hidden=true;
  root.document.getElementById('standbyScreen').hidden=false;
  setStartupStatus('Sega runtime failed'+(error?.message?': '+String(error.message).slice(0,85):'')+' · reload required');
 };
 root.addEventListener('jhadina-sega:runtime-ready',onReady,{once:true});
 root.addEventListener('jhadina-sega:rom-loaded',onLoaded,{once:true});
 root.addEventListener('jhadina-sega:runtime-error',onError,{once:true});
 try{
  // A renderer can report ready while the ROM event remains unhandled.
  // Record the stalled phase on-device instead of implying gameplay succeeded.
  armStartupWatchdog();
  // DO NOT await indefinitely; winit owns the emulator event loop.
  // wasm-bindgen consumes ownership of arguments to run_emulator (sets their
  // JS __wbg_ptr to 0). Keep the original Rc-backed command channel alive for
  // runtime-ready, Genesis input, and save-state callbacks. Rust Clone shares
  // the underlying Rc<RefCell<VecDeque<EmulatorCommand>>> command queue.
  Promise.resolve(module.run_emulator(config,channel.clone())).catch(onError);
  return {accepted:true,gameId};
 }catch(error){onError();throw error}
}
function awaitStateEvent(successName,request){
 if(stateInFlight)throw Error('A Sega state action is already running');
 stateInFlight=true;
 return new Promise((resolve,reject)=>{
  let timer;
  const cleanup=()=>{
   root.removeEventListener(successName,ok);
   root.removeEventListener('jhadina-sega:state-failed',fail);
   root.clearTimeout(timer);
   stateInFlight=false;
  };
  const ok=event=>{cleanup();resolve(event.detail||{})};
  const fail=event=>{cleanup();reject(Error(event.detail?.reason||'Genesis state rejected'))};
  root.addEventListener(successName,ok,{once:true});
  root.addEventListener('jhadina-sega:state-failed',fail,{once:true});
  timer=root.setTimeout(()=>{cleanup();reject(Error('Genesis state request timed out'))},12000);
  try{if(request()!==true)throw Error('WASM state bridge rejected request')}
  catch(error){cleanup();reject(error)}
 });
}
function saveState(){
 if(!stateCoordinator)throw Error('Genesis save-state coordinator not initialized');
 return stateCoordinator.saveState();
}
function loadState(){
 if(!stateCoordinator)throw Error('Genesis save-state coordinator not initialized');
 return stateCoordinator.loadState();
}
root.JhadinaSegaRuntime=Object.freeze({verifyManifest,loadApproved,readVerifiedCartridge,play,saveState,loadState,sha256});
})(globalThis);
