import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
import {runInNewContext,Script} from 'node:vm';

const file='apps/jhadina-web/public/gaming/sega/runtime-loader.js';
const source=readFileSync(file,'utf8');
new Script(source,{filename:file});
const approvedFiles=[
 'pkg/jgenesis_web.js','pkg/jgenesis_web_bg.wasm',
 'js/ui.js','js/idb.js','js/audio-processor.js','js/polyfill.js',
 'pkg/snippets/jgenesis-web-0123456789abcdef/js/ui.js',
 'pkg/snippets/jgenesis-web-0123456789abcdef/js/idb.js',
 'pkg/snippets/jgenesis-web-0123456789abcdef/js/polyfill.js'
];
const assets=Object.fromEntries(approvedFiles.map((name,i)=>[name,new Uint8Array([i+1,8,7,6,5])]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest={
 schema:'jhadina.sega.jgenesis.approved.v1',
 sourceCommit:'220421984e710758cb691dcd1dd6a757ae9aca72',
 bridgeApi:'jhadina.sega.jgenesis.bridge.v1',
 operatorApproved:true,licenseReviewed:true,
 files:Object.fromEntries(approvedFiles.map(name=>[name,sha(assets[name])]))
};
let provided=null;
const records=new Map(),clone=x=>structuredClone(x);
const root={
 Uint8Array,crypto:webcrypto,navigator:{gpu:{requestAdapter:async()=>({})}},
 location:{protocol:'https:',hostname:'localhost'},isSecureContext:true,crossOriginIsolated:true,
 fetch:async url=>{
  if(url.endsWith('manifest.approved.json')){
   if(!provided)return {ok:false,status:404};
   return {ok:true,json:async()=>provided};
  }
  const path=url.split('/gaming/sega/vendor/')[1];
  const bytes=assets[path];return bytes?{ok:true,arrayBuffer:async()=>bytes.buffer.slice(0)}:{ok:false,status:404};
 },
 indexedDB:{open:()=>{const req={result:null,onsuccess:null,onerror:null,onupgradeneeded:null};
  queueMicrotask(()=>{
   const db={
    close(){},
    objectStoreNames:{contains:()=>true},
    transaction:()=>({
     objectStore:()=>({get:key=>{
      const r={result:null,onsuccess:null,onerror:null};
      queueMicrotask(()=>{r.result=clone(records.get(key));r.onsuccess?.()});return r;
     }})
    })
   };req.result=db;req.onsuccess?.();
  });return req;
 }}
};
runInNewContext(source,root);
const runtime=root.JhadinaSegaRuntime;
await assert.rejects(()=>runtime.verifyManifest(),/not installed/);
provided={...manifest,operatorApproved:false};
await assert.rejects(()=>runtime.verifyManifest(),/not independently approved/);
provided=manifest;
assert.equal((await runtime.verifyManifest()).operatorApproved,true);
const orig=assets['pkg/jgenesis_web_bg.wasm'];
assets['pkg/jgenesis_web_bg.wasm']=new Uint8Array([8,9,10]);
await assert.rejects(()=>runtime.verifyManifest(),/hash mismatch/);
assets['pkg/jgenesis_web_bg.wasm']=orig;
const digest='a'.repeat(64),gameId='gen-'+digest.slice(0,24);
records.set('genrom:'+gameId,{payload:{sha256:digest,bytes:new Uint8Array([1,2,3])}});
const owned=await runtime.readVerifiedCartridge({gameId,romSha:digest});
assert.deepEqual([...owned],[1,2,3]);
owned[0]=98;
assert.equal(records.get('genrom:'+gameId).payload.bytes[0],1);
await assert.rejects(()=>runtime.play({gameId,romSha:digest}),/SHA-256 mismatch/);
await assert.rejects(()=>runtime.readVerifiedCartridge({gameId:'invalid',romSha:digest}),/Invalid Sega cartridge/);
const src=readFileSync('scripts/sega-prepare-jgenesis-bridge.mjs','utf8');
assert(src.includes('request_open_verified_rom')&&src.includes('request_genesis_input'));
const app=readFileSync('apps/jhadina-web/public/gaming/sega/app.js','utf8');
const html=readFileSync('apps/jhadina-web/public/gaming/sega/index.html','utf8');
assert(html.includes('id="jgenesis-wasm"')&&html.includes('id="checkEngine"'));
assert(html.includes('/gaming/sega/runtime-loader.js')&&html.includes('/gaming/sega/sram.js'));
assert(html.includes('/gaming/sega/states.js')&&html.includes('id="saveGenesisState"')&&html.includes('id="loadGenesisState"'));
assert(html.includes('/gaming/sega/state-coordinator.js'), 'Genesis coordinator must load before runtime');
assert(html.indexOf('/gaming/sega/state-coordinator.js')<html.indexOf('/gaming/sega/runtime-loader.js'));
assert(source.includes("root.dispatchEvent(new Event('jhadina-sega:gameplay-ready'))"),'Separate verified gameplay-ready event required');
assert(app.includes("window.addEventListener('jhadina-sega:gameplay-ready'"),'Save UI must await gameplay-ready, not ROM-loaded');
assert(app.includes('active?.loaded===true&&!active.stopped'),'Failed/unfinished gameplay cannot re-enable save UI');
assert(source.includes('session.loaded=true')&&source.includes('session.loaded=false'),
 'Save-state actions must track confirmed cartridge readiness and teardown');
assert(source.includes('root.JhadinaSegaStateCoordinator.create('),
 'Runtime must use an operation coordinator spanning asynchronous persistence');
assert(typeof runtime.saveState==='function'&&typeof runtime.loadState==='function');
assert(app.includes('await window.JhadinaSegaRuntime.verifyManifest()'));
assert(app.includes('segaEngineReviewed&&available')&&app.includes('await window.JhadinaSegaRuntime.play('));
const runtimeText=readFileSync('apps/jhadina-web/public/gaming/sega/runtime-loader.js','utf8');
assert(runtimeText.includes("container.style.visibility='hidden'")&&runtimeText.includes("container.style.visibility='visible'"));
assert(runtimeText.indexOf("container.hidden=false")<runtimeText.indexOf('module.run_emulator(config,channel.clone())'),
 'Jgenesis WebGPU surface must have layout before winit initializes');
assert(runtimeText.includes("session.stopped=true")&&runtimeText.includes("container.hidden=true"),
 'Failed WebGPU startup must disable save bridge and hide uninitialized canvas');
assert(source.includes('request_save_genesis_state')&&source.includes('request_load_genesis_state'));
const middleware=readFileSync('apps/jhadina-web/src/lib/supabase/middleware.ts','utf8');
for(const path of ['/gaming/sega/states.js','/gaming/sega/state-coordinator.js','/gaming/sega/runtime-loader.js','/gaming/sega/vendor/pkg/jgenesis_web_bg.wasm'])
 assert(middleware.includes('"'+path+'"'));

/* Regression: wasm-bindgen run_emulator(config, channel) TAKES OWNERSHIP of
 * both handles. The JS wrapper zeroes channel.__wbg_ptr; only a clone keeps
 * the host's command channel usable when showUi dispatches runtime-ready.
 * This browser simulation tests the actual loader code with a Rust-like
 * shared-queue channel and no real private ROM or distributed binary.
 */
const ownedBytes=Uint8Array.of(9,17,42,61);
const ownedSha=sha(ownedBytes),ownedId='gen-'+ownedSha.slice(0,24);
records.set('genrom:'+ownedId,{payload:{sha256:ownedSha,bytes:ownedBytes}});
const sharedQueue=[];
const nativeChannel={
 __wbg_ptr:71,
 clone(){return {__wbg_ptr:72,sharedQueue}},
 request_open_verified_rom(name,bytes){
  if(this.__wbg_ptr===0)throw Error('null pointer passed to rust');
  sharedQueue.push({name,bytes:Array.from(bytes)});return true;
 }
};
const nodes=new Map([
 ['jgenesis-wasm',{hidden:true,style:{},querySelector:()=>({})}],
 ['standbyScreen',{hidden:false}],
 ['runtimeStatus',{textContent:''}]
]);
const events=new EventTarget();
let activated=0,passedChannel=null;
const runtimeHost={
 ...root,
 Event,CustomEvent:class extends Event{constructor(type,opts){super(type);this.detail=opts?.detail}},
 setTimeout,clearTimeout,
 addEventListener:events.addEventListener.bind(events),
 removeEventListener:events.removeEventListener.bind(events),
 dispatchEvent:events.dispatchEvent.bind(events),
 document:{getElementById:id=>nodes.get(id)||null},
 JhadinaSegaSram:{},JhadinaSegaStates:{read:async()=>null},
 JhadinaSegaStateCoordinator:{create:()=>({})},
 JhadinaSegaInput:{create:()=>({activate(){activated++},deactivate(){}})},
 __mockApproved:async()=>({
  channel:nativeChannel,config:{},localTest:true,
  module:{run_emulator(_config,consumed){
   passedChannel=consumed;consumed.__wbg_ptr=0;
   events.dispatchEvent(new Event('jhadina-sega:runtime-ready'));
   if(sharedQueue.length)events.dispatchEvent(new Event('jhadina-sega:rom-loaded'));
   return Promise.resolve();
  }}
 })
};
const playbackSource=source.replace(
 'const {module,channel,config,localTest}=await loadApproved();',
 'const {module,channel,config,localTest}=await root.__mockApproved();'
);
assert.notEqual(playbackSource,source,'Must inject only the approved runtime factory for the ownership test');
new Script(playbackSource,{filename:'runtime-loader-ownership-fixture.js'}).runInNewContext(runtimeHost);
const started=await runtimeHost.JhadinaSegaRuntime.play({gameId:ownedId,romSha:ownedSha});
assert.equal(started.accepted,true);
assert.equal(nativeChannel.__wbg_ptr,71,'Host channel must remain usable after WASM takes the clone');
assert.equal(passedChannel.__wbg_ptr,0,'Simulate wasm-bindgen consuming the renderer channel');
assert.equal(sharedQueue.length,1,'The verified ROM command must reach the live shared queue');
assert.equal(sharedQueue[0].name,ownedId+'.md');
assert.deepEqual(sharedQueue[0].bytes,[...ownedBytes]);
assert.equal(runtimeHost.JhadinaSegaActive.loaded,true,'ROM-loaded callback must reach actual gameplay transition');
assert.equal(nodes.get('standbyScreen').hidden,true);
assert.equal(activated,1,'Controller must activate only after ROM load');
console.log('PASS: wasm-bindgen consumes its clone, not the live Sega command channel; ROM load and gameplay-ready callback succeed');

console.log('PASS: deny missing/unapproved/tampered runtime, SHA-guarded owner bytes and gated landscape Play');
console.log('NO actual Jgenesis WASM was downloaded, built, approved, booted or tested on iPhone');
