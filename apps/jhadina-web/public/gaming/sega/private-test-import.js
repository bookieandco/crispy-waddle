/* Browser-local, test-only Jgenesis package importer.
 * Requires an EXACT independently source-matched, owner-held ZIP from Files.
 * Does not publish binary assets, game ROMs, saves, or licensing approvals.
 */
(function(root){
'use strict';
const ZIP_SHA='fde6d922b0f3d01f353946ea93484ec2a4a3bf5b57d363e941b1bcfee01f092c';
const SOURCE_SHA='aca3f2741f8b23da0aaf4433a3cccb78eb0f449696b08f4c748be7dedd2c900d';
const WASM_SHA='2eaf8451759b14b66cf29650bee168dd28842fa0ed92cdf2635ad2d42770f57d';
const MANIFEST_SHA='48785a6bea748d784669e4b88a1c2b03354b501e905c9df675be8fd6422809cd';
const PIN='220421984e710758cb691dcd1dd6a757ae9aca72';
const COMMIT='80e12df229e44acae065c13d5ef7248f21cf3e2c';
const CACHE='jhadina-sega-private-owner-test-80e12df2-v1';
const PREFIX='/gaming/sega/vendor/';
const LOCAL_MANIFEST=PREFIX+'manifest.local-test.json';
const REQUIRED=['private-test-package.json','LICENSE.jgenesis','manifest.unapproved.json',
 'review.hash-receipt.json','source.receipt.unapproved.json','REBUILD.md',
 'jgenesis-patched-source.tar.gz','jgenesis-jhadina-bridge.patch'];
const bytesToHex=a=>Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');
async function sha(bytes){return bytesToHex(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)))}
function check(test,message){if(!test)throw Error(message)}
function u16(b,o){check(o>=0&&o+2<=b.length,'Truncated Sega package');return b[o]|(b[o+1]<<8)}
function u32(b,o){check(o>=0&&o+4<=b.length,'Truncated Sega package');return (b[o]+b[o+1]*256+b[o+2]*65536+b[o+3]*16777216)>>>0}
async function inflate(data,expected){
 check(typeof root.DecompressionStream==='function','ZIP decompression unavailable; use Safari with ZIP support');
 const stream=new Blob([data]).stream().pipeThrough(new root.DecompressionStream('deflate-raw'));
 const reader=stream.getReader(),output=new Uint8Array(expected);
 let off=0;
 try{
  while(true){const chunk=await reader.read();if(chunk.done)break;
   check(off+chunk.value.length<=expected,'Compressed Sega asset expansion exceeded bounds');
   output.set(chunk.value,off);off+=chunk.value.length;
  }
 }catch(error){try{await reader.cancel()}catch{}throw error}
 finally{reader.releaseLock()}
 check(off===expected,'Sega asset decompressed size mismatch');
 return output;
}
async function unzip(input){
 const b=new Uint8Array(input);
 check(b.length>30&&b.length<6*1024*1024,'Private test package size invalid');
 let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){
  if(u32(b,i)===0x06054b50&&i+22+u16(b,i+20)===b.length){end=i;break}
 }
 check(end>=0,'Private test ZIP has no central directory');
 const count=u16(b,end+10),start=u32(b,end+16),length=u32(b,end+12);
 check(count>=16&&count<=32&&start+length===end&&u16(b,end+8)===count,'Private test ZIP central directory invalid');
 const files=new Map();let off=start;
 for(let n=0;n<count;n++){
  check(u32(b,off)===0x02014b50&&off+46<=end,'Private ZIP entry invalid');
  const flags=u16(b,off+8),method=u16(b,off+10),crc=u32(b,off+16),
   compressed=u32(b,off+20),expanded=u32(b,off+24),nameLen=u16(b,off+28),
   extra=u16(b,off+30),comment=u16(b,off+32),local=u32(b,off+42);
  check(!(flags&1)&&!(flags&64)&&(method===0||method===8),'Unsupported ZIP flags/compression');
  check(nameLen>0&&nameLen<180&&expanded<=12*1024*1024&&compressed<=6*1024*1024,'Unbounded ZIP entry');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(off+46,off+46+nameLen));
  check(/^[A-Za-z0-9_.\/-]+$/.test(name)&&!name.startsWith('/')&&!name.includes('..')&&!name.includes('//')&&!files.has(name),'Unsafe/repeated ZIP path');
  check(u32(b,local)===0x04034b50&&u16(b,local+8)===method,'ZIP local header mismatch');
  const localNameLen=u16(b,local+26),localExtra=u16(b,local+28);
  check(localNameLen===nameLen,'ZIP name disagreement');
  const at=local+30+localNameLen+localExtra;
  check(at+compressed<=start,'ZIP asset extends beyond data region');
  const raw=b.subarray(at,at+compressed);
  const value=method===0?raw.slice():await inflate(raw,expanded);
  check(value.length===expanded,'ZIP entry length mismatch');
  // Package has a whole-archive pinned SHA, so per-entry CRC is advisory.
  if(root.JhadinaSegaCartridge?.crc32)check(root.JhadinaSegaCartridge.crc32(value)===crc,'ZIP CRC failure: '+name);
  files.set(name,value);
  off+=46+nameLen+extra+comment;
 }
 check(off===end,'ZIP directory trailing bytes');
 return files;
}
function parsed(files,name){return JSON.parse(new TextDecoder().decode(files.get(name)))}
function mime(name){
 if(name.endsWith('.wasm'))return 'application/wasm';
 if(name.endsWith('.js'))return 'text/javascript; charset=utf-8';
 return 'application/json; charset=utf-8';
}
function ownWorkerControlsPage(){
 const worker=root.navigator?.serviceWorker?.controller;
 if(!worker?.scriptURL)return false;
 try{
  const script=new URL(worker.scriptURL,root.location?.href||root.location?.origin);
  return script.origin===root.location.origin&&script.pathname==='/gaming/sega/private-test-sw.js';
 }catch{return false}
}
async function isInstalled(){
 if(!ownWorkerControlsPage()||!root.caches)return false;
 const cache=await root.caches.open(CACHE);
 const r=await cache.match(LOCAL_MANIFEST);
 if(!r)return false;
 try{
  const data=await r.json();
  return data?.schema==='jhadina.sega.jgenesis.local-test.v1'&&
   data?.sourceCommit===PIN&&data?.sourceReceiptSha256===SOURCE_SHA&&
   data?.wasmSha256===WASM_SHA&&data?.testOnly===true&&
   data?.operatorApproved===false&&data?.licenseReviewed===false;
 }catch{return false}
}
async function install(file){
 check(root.isSecureContext&&root.crossOriginIsolated,'Secure isolated browser required for emulator test');
 check(root.navigator?.serviceWorker&&root.caches,'Private test requires Service Worker and CacheStorage');
 check(file&&file.size>=200000&&file.size<6*1024*1024,'Select the 2.8 MB private owner-test package from Files');
 const buffer=await file.arrayBuffer();
 check(await sha(buffer)===ZIP_SHA,'Test ZIP does not match the exact source-reviewed build');
 const files=await unzip(buffer);
 const meta=parsed(files,'private-test-package.json');
 check(await sha(files.get('private-test-package.json'))===MANIFEST_SHA,'Private test package manifest fingerprint mismatch');
 check(meta.schema==='jhadina.sega.private-owner-test-package.v1'&&
  meta.testOnly===true&&meta.operatorApproved===false&&meta.licenseReviewed===false&&
  meta.readyForProduction===false&&meta.romsIncluded===false&&meta.saveDataIncluded===false&&
  meta.sourceCommit===PIN&&meta.jhadinaSourceCommit===COMMIT&&
  meta.sourceReceiptSha256===SOURCE_SHA&&meta.wasmSha256===WASM_SHA,'Unreviewed source/test package');
 const sourceReceipt=parsed(files,'source.receipt.unapproved.json');
 check(sourceReceipt.jhadinaSourceCommit===COMMIT&&sourceReceipt.wasmSha256===WASM_SHA&&
  sourceReceipt.operatorApproved===false&&sourceReceipt.licenseReviewed===false,'Incorrect source receipt');
 const assetNames=Object.keys(meta.files||{});
 check(assetNames.length===files.size-1,'Private test package file count differs from manifest');
 check(assetNames.every(name=>files.has(name))&&REQUIRED.every(name=>files.has(name)),
  'Private source/build evidence missing');
 for(const name of assetNames){
  check(await sha(files.get(name))===meta.files[name],'Source-reviewed private test asset failed SHA: '+name);
 }
 const build=parsed(files,'manifest.unapproved.json');
 check(build.sourceCommit===PIN&&build.operatorApproved===false&&build.licenseReviewed===false&&
  build.files['pkg/jgenesis_web_bg.wasm']===WASM_SHA,'Unapproved WASM source manifest invalid');
 const names=Object.keys(build.files);
 check(names.length===9&&names.every(name=>files.has('vendor/'+name)&&
   meta.files['vendor/'+name]===build.files[name]),'Patched Jgenesis asset set mismatch');
 const sourceArchive=files.get('jgenesis-patched-source.tar.gz');
 check(sourceArchive.byteLength>10000&&meta.files['jgenesis-patched-source.tar.gz'], 'GPL corresponding source absent');
 const reg=await root.navigator.serviceWorker.register('/gaming/sega/private-test-sw.js',
  {scope:'/gaming/sega/',updateViaCache:'none'});
 await root.navigator.serviceWorker.ready;
 check(reg.active,'Private Sega service worker was not activated');
 const cache=await root.caches.open(CACHE);
 // Commit in a single phase only after checking every byte. No ROMs or saves.
 await root.caches.delete(CACHE);
 const clean=await root.caches.open(CACHE);
 try{
  for(const name of names){
   await clean.put(PREFIX+name,new Response(files.get('vendor/'+name),
    {headers:{'Content-Type':mime(name),'Cache-Control':'no-store','Cross-Origin-Resource-Policy':'same-origin'}}));
  }
  const local={schema:'jhadina.sega.jgenesis.local-test.v1',sourceCommit:PIN,
   bridgeApi:'jhadina.sega.jgenesis.bridge.v1',testOnly:true,localOnly:true,
   operatorApproved:false,licenseReviewed:false,sourceReceiptSha256:SOURCE_SHA,
   wasmSha256:WASM_SHA,files:build.files};
  await clean.put(LOCAL_MANIFEST,new Response(JSON.stringify(local),
   {headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}));
 }catch(e){await root.caches.delete(CACHE);throw e}
 return {sourceCommit:PIN,wasmSha256:WASM_SHA,needsReload:!ownWorkerControlsPage(),
  testOnly:true,licenseReviewed:false};
}
root.JhadinaSegaLocalTest=Object.freeze({install,isInstalled,zipSha256:ZIP_SHA});
})(globalThis);
