import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext,Script} from 'node:vm';
const file='apps/jhadina-web/public/gaming/sega/private-test-import.js';
const raw=readFileSync(file,'utf8');
new Script(raw,{filename:file});
const hash=b=>createHash('sha256').update(b).digest('hex');
const enc=new TextEncoder();
const u32=(b,o,v)=>b.writeUInt32LE(v>>>0,o);
const u16=(b,o,v)=>b.writeUInt16LE(v,o);
function createStoredZip(files){
 const local=[],central=[];let offset=0;
 for(const [name,value] of Object.entries(files)){
  const n=Buffer.from(name),data=Buffer.from(value);
  const h=Buffer.alloc(30);u32(h,0,0x04034b50);u16(h,4,20);u16(h,8,0);
  u32(h,18,data.length);u32(h,22,data.length);u16(h,26,n.length);
  local.push(h,n,data);
  const c=Buffer.alloc(46);u32(c,0,0x02014b50);u16(c,4,20);
  u16(c,6,20);u32(c,20,data.length);u32(c,24,data.length);
  u16(c,28,n.length);u32(c,42,offset);
  central.push(c,n);offset+=h.length+n.length+data.length;
 }
 const cdata=Buffer.concat(central),eocd=Buffer.alloc(22);
 u32(eocd,0,0x06054b50);u16(eocd,8,Object.keys(files).length);
 u16(eocd,10,Object.keys(files).length);u32(eocd,12,cdata.length);u32(eocd,16,offset);
 return Buffer.concat([...local,cdata,eocd]);
}
const pin='220421984e710758cb691dcd1dd6a757ae9aca72',commit='80e12df229e44acae065c13d5ef7248f21cf3e2c';
const names=['pkg/jgenesis_web.js','pkg/jgenesis_web_bg.wasm','js/ui.js','js/idb.js',
 'js/audio-processor.js','js/polyfill.js',
 'pkg/snippets/jgenesis-web-7d2b5d9cb20facbb/js/ui.js',
 'pkg/snippets/jgenesis-web-7d2b5d9cb20facbb/js/idb.js',
 'pkg/snippets/jgenesis-web-7d2b5d9cb20facbb/js/polyfill.js'];
const files={};
for(const name of names)files['vendor/'+name]=name.endsWith('.wasm')?
 Buffer.concat([Buffer.from([0,97,115,109,1,0,0,0]),Buffer.alloc(48)]):
 enc.encode('// test-only module '+name);
const wasmSha=hash(files['vendor/pkg/jgenesis_web_bg.wasm']);
const build={schema:'jhadina.sega.jgenesis.unapproved-build.v1',sourceCommit:pin,
 bridgeApi:'jhadina.sega.jgenesis.bridge.v1',operatorApproved:false,licenseReviewed:false,
 files:Object.fromEntries(names.map(n=>[n,hash(files['vendor/'+n])]))};
const sourceReceipt={sourceCommit:pin,jhadinaSourceCommit:commit,
 wasmSha256:wasmSha,operatorApproved:false,licenseReviewed:false};
files['manifest.unapproved.json']=enc.encode(JSON.stringify(build));
files['review.hash-receipt.json']=enc.encode('{"approvedForBrowserUse":false}');
files['source.receipt.unapproved.json']=enc.encode(JSON.stringify(sourceReceipt));
files['LICENSE.jgenesis']=enc.encode('GNU GENERAL PUBLIC LICENSE');
files['REBUILD.md']=enc.encode('Test-only fixture build instructions');
files['jgenesis-patched-source.tar.gz']=Buffer.alloc(240000,17);
files['jgenesis-jhadina-bridge.patch']=enc.encode('synthetic patch');
const sourceSha=hash(files['source.receipt.unapproved.json']);
const packageManifest={schema:'jhadina.sega.private-owner-test-package.v1',
 testOnly:true,operatorApproved:false,licenseReviewed:false,readyForProduction:false,
 romsIncluded:false,saveDataIncluded:false,sourceCommit:pin,jhadinaSourceCommit:commit,
 sourceReceiptSha256:sourceSha,wasmSha256:wasmSha,
 files:Object.fromEntries(Object.entries(files).map(([name,data])=>[name,hash(data)]))};
files['private-test-package.json']=enc.encode(JSON.stringify(packageManifest));
const zip=createStoredZip(files),zipSha=hash(zip),manifestSha=hash(files['private-test-package.json']);
let amended=raw.replace('fde6d922b0f3d01f353946ea93484ec2a4a3bf5b57d363e941b1bcfee01f092c',zipSha)
 .replace('aca3f2741f8b23da0aaf4433a3cccb78eb0f449696b08f4c748be7dedd2c900d',sourceSha)
 .replace('2eaf8451759b14b66cf29650bee168dd28842fa0ed92cdf2635ad2d42770f57d',wasmSha)
 .replace('48785a6bea748d784669e4b88a1c2b03354b501e905c9df675be8fd6422809cd',manifestSha);
const cache=new Map(),cacheStore={put:async(key,response)=>cache.set(key,response.clone()),
 match:async key=>cache.get(key)?.clone()},records={};
const root={Blob,Response,Uint8Array,DecompressionStream,TextDecoder,crypto:webcrypto,
 isSecureContext:true,crossOriginIsolated:true,
 navigator:{serviceWorker:{controller:{scriptURL:'test-sw'},ready:Promise.resolve({active:{}}),
  register:async()=>({active:{}})}},
 caches:{open:async()=>cacheStore,delete:async()=>{cache.clear();return true}},
 location:{origin:'https://preview.test'},
};
runInNewContext(amended,root);
const installer=root.JhadinaSegaLocalTest;
assert.equal(await installer.isInstalled(),false);
const tampered=Buffer.from(zip);tampered[tampered.length-1]^=0x7f;
await assert.rejects(()=>installer.install({size:tampered.length,arrayBuffer:async()=>tampered}),/does not match/);
assert.equal(cache.size,0,'Corrupt archive must be rejected before installation');
const installed=await installer.install({size:zip.length,arrayBuffer:async()=>zip});
assert.equal(installed.testOnly,true);
assert.equal(installed.licenseReviewed,false);
assert.equal(installed.needsReload,false);
assert.equal(await installer.isInstalled(),true);
assert.equal(cache.size,10,'Only nine browser executables and one test-only manifest are cached');
const local=await cacheStore.match('/gaming/sega/vendor/manifest.local-test.json');
const obj=await local.json();
assert.equal(obj.operatorApproved,false);
assert.equal(obj.licenseReviewed,false);
assert.equal(obj.testOnly,true);
assert.equal(obj.files['pkg/jgenesis_web_bg.wasm'],wasmSha);
assert.equal(cache.has('/gaming/sega/vendor/manifest.approved.json'),false);
assert.equal(cache.has('/gaming/sega/vendor/my-sonic-rom.bin'),false);
const html=readFileSync('apps/jhadina-web/public/gaming/sega/index.html','utf8');
const runtime=readFileSync('apps/jhadina-web/public/gaming/sega/runtime-loader.js','utf8');
const app=readFileSync('apps/jhadina-web/public/gaming/sega/app.js','utf8');
const middleware=readFileSync('apps/jhadina-web/src/lib/supabase/middleware.ts','utf8');
assert(html.includes('id="privateEnginePackage"')&&html.includes('/gaming/sega/private-test-import.js'));
assert(runtime.includes('manifest.local-test.json')&&runtime.includes("manifest?.operatorApproved!==false"));
assert(app.includes('JhadinaSegaLocalTest.install(file)'));
for(const p of ['/gaming/sega/private-test-import.js','/gaming/sega/private-test-sw.js'])
 assert(middleware.includes('"'+p+'"'),'Static test source must be middleware allowlisted');
console.log('PASS: exact private ZIP import, no license auto-approval, isolated same-origin cache and tamper rejection');
console.log('No source license clearance, ROM upload or browser gameplay certification was produced.');
