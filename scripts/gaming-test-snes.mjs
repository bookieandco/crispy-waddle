#!/usr/bin/env node
/* SNES phone-lab contract smoke: no commercial ROM fixtures. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
import vm from 'node:vm';
const src=readFileSync('apps/jhadina-web/public/gaming/snes/player.js','utf8');
const html=readFileSync('apps/jhadina-web/public/gaming/snes/index.html','utf8');
const middleware=readFileSync('apps/jhadina-web/src/lib/supabase/middleware.ts','utf8');
assert.match(html,/orientation:landscape/);
assert.match(html,/id="rom"/);
assert.match(html,/id="game"/);
assert.match(middleware,/\/gaming\/snes\/player\.js/);
assert.match(middleware,/isPublicEmulatorRuntimeAsset/);
assert.ok(!/cdn\.emulatorjs\.org|http:\/\/.*\.(?:smc|sfc)/.test(src),'no remote executable CDN or game URL');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fakeLoader='window.EJS_loader_test=true;';
const loaderHash=sha(fakeLoader);
const ARCHIVE_SHA='07d451bc06fa3ad04ab30d9b94eb63ac34ad0babee52d60357b002bde8f3850b';
function harness({manifestValid=true}={}){
 const events={},elements={},scripts=[],requests=[];
 function element(id){return elements[id]??=( {disabled:false,textContent:'',style:{},classList:{toggle(){return true;}},setAttribute(){},addEventListener(type,cb){events[id+':'+type]=cb;}});}
 const manifest={schema:'jhadina.gaming.emulatorjs.approved.v1',version:'v4.2.3',
  archiveSha256:ARCHIVE_SHA,coreIds:['gb','snes'],loaderSha256:manifestValid?loaderHash:'f'.repeat(64),
  dataPath:'/vendor/emulatorjs/approved/data/'};
 const doc={getElementById:element,createElement:()=>({}),body:{appendChild:e=>scripts.push(e)}};
 const root={document:doc,isSecureContext:true,crypto:webcrypto,
  URL:{createObjectURL:()=> 'blob:local-private-cart',revokeObjectURL(){}},
  fetch:async url=>{requests.push(url);if(url.endsWith('/manifest.json'))return {ok:true,json:async()=>manifest};
   if(url.endsWith('/loader.js'))return {ok:true,type:'basic',arrayBuffer:async()=>new TextEncoder().encode(fakeLoader).buffer};
   throw Error('Unexpected request: '+url);},
  addEventListener(){},AudioContext:undefined};
 vm.runInNewContext(src,{window:root,Uint8Array,TextDecoder,Array,Blob,Promise,Error},{filename:'snes/player.js'});
 return {events,elements,scripts,requests,root};
}
const makeFile=(name,b)=>({name,size:b.length,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)});
const sample=new Uint8Array(65536);
async function select(h,file){await h.events['rom:change']({target:{files:[file]}});}
{
 const h=harness();assert.equal(h.elements.boot.disabled,false); // HTML has disabled attribute; fake DOM defaults to false
 await select(h,makeFile('Sample.smc',sample));
 assert.equal(h.elements.boot.disabled,false);
 assert.match(h.elements.status.textContent,/verified/i);
 assert.equal(h.requests.length,0,'cartridge never transmitted or fetched');
 await h.events['boot:click']();
 assert.equal(h.scripts.length,1);
 assert.equal(h.scripts[0].src,'/vendor/emulatorjs/approved/data/loader.js');
 assert.equal(h.root.EJS_core,'snes');
 assert.equal(h.root.EJS_controlScheme,'snes');
 assert.equal(h.root.EJS_gameUrl,'blob:local-private-cart');
 assert.equal(h.root.EJS_volume,1);
 assert.equal(h.root.EJS_startOnLoaded,false);
 assert.equal(h.requests.length,2,'only local manifest and loader are fetched');
}
{
 const h=harness({manifestValid:false});
 await select(h,makeFile('Sample.sfc',sample));
 await h.events['boot:click']();
 assert.equal(h.scripts.length,0,'modified loader must never execute');
 assert.match(h.elements.status.textContent,/SHA-256 mismatch/);
}
{
 const h=harness();
 await select(h,makeFile('../bad.smc',sample));
 assert.equal(h.elements.boot.disabled,true);
 assert.equal(h.requests.length,0);
}
{
 const h=harness();
 await select(h,makeFile('huge.smc',new Uint8Array(9*1024*1024)));
 assert.equal(h.elements.boot.disabled,true);
}
console.log('SNES browser-lab contracts passed: local input, pinned loader, fail-closed hashes, size/path denial, controls/audio settings.');
