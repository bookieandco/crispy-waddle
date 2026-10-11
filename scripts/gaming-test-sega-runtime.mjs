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
assert(typeof runtime.saveState==='function'&&typeof runtime.loadState==='function');
assert(app.includes('await window.JhadinaSegaRuntime.verifyManifest()'));
assert(app.includes('segaEngineReviewed&&available')&&app.includes('await window.JhadinaSegaRuntime.play('));
const runtimeText=readFileSync('apps/jhadina-web/public/gaming/sega/runtime-loader.js','utf8');
assert(runtimeText.includes("container.style.visibility='hidden'")&&runtimeText.includes("container.style.visibility='visible'"));
assert(runtimeText.indexOf("container.hidden=false")<runtimeText.indexOf('module.run_emulator(config,channel)'),
 'Jgenesis WebGPU surface must have layout before winit initializes');
assert(runtimeText.includes("session.stopped=true")&&runtimeText.includes("container.hidden=true"),
 'Failed WebGPU startup must disable save bridge and hide uninitialized canvas');
assert(source.includes('request_save_genesis_state')&&source.includes('request_load_genesis_state'));
const middleware=readFileSync('apps/jhadina-web/src/lib/supabase/middleware.ts','utf8');
for(const path of ['/gaming/sega/states.js','/gaming/sega/runtime-loader.js','/gaming/sega/vendor/pkg/jgenesis_web_bg.wasm'])
 assert(middleware.includes('"'+path+'"'));
console.log('PASS: deny missing/unapproved/tampered runtime, SHA-guarded owner bytes and gated landscape Play');
console.log('NO actual Jgenesis WASM was downloaded, built, approved, booted or tested on iPhone');
