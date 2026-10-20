import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
const PIN='220421984e710758cb691dcd1dd6a757ae9aca72';
const sha=x=>createHash('sha256').update(x).digest('hex');
const blobId=x=>createHash('sha1').update(Buffer.from('blob '+x.length+'\0')).update(x).digest('hex');
const BOOT_DATA=['backend/s32x-core/src/m68k_vectors.bin','backend/s32x-core/src/sh2_master_boot_rom.bin','backend/s32x-core/src/sh2_slave_boot_rom.bin'];
const temp=mkdtempSync(join(tmpdir(),'sega-gpl-review-'));
const build=join(temp,'build'),candidate=join(temp,'candidate'),source=join(temp,'source'),tree=join(temp,'tree');
const MODIFIED=['frontend/jgenesis-web/js/idb.js','frontend/jgenesis-web/js/ui.js',
 'frontend/jgenesis-web/src/audio.rs','frontend/jgenesis-web/src/config.rs',
 'frontend/jgenesis-web/src/js.rs','frontend/jgenesis-web/src/lib.rs'].sort();
const SUPPORT=['scripts/sega-prepare-jgenesis-bridge.mjs','scripts/sega-build-jgenesis-wasm.sh',
 'scripts/sega-review-jgenesis-artifacts.mjs','scripts/sega-verify-compiled-wasm.mjs',
 'apps/jhadina-web/public/gaming/sega/vendor/js/ui.js',
 'apps/jhadina-web/public/gaming/sega/vendor/js/idb.js'];
const names=['js/audio-processor.js','js/idb.js','js/polyfill.js','js/ui.js',
 'pkg/jgenesis_web.js','pkg/jgenesis_web_bg.wasm',
 'pkg/snippets/jgenesis-web-0123456789abcdef/js/ui.js',
 'pkg/snippets/jgenesis-web-0123456789abcdef/js/idb.js',
 'pkg/snippets/jgenesis-web-0123456789abcdef/js/polyfill.js'];
const put=(base,path,data)=>{const dest=join(base,path);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,data)};
const cli=(script,...args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',maxBuffer:2*1024*1024});
const tar=(...args)=>spawnSync('tar',args,{encoding:'utf8',maxBuffer:2*1024*1024});
try{
 const assets={};
 for(const name of names){
  const data=name.endsWith('.wasm')?Buffer.concat([Buffer.from([0,97,115,109,1,0,0,0]),Buffer.alloc(32)])
   :Buffer.from('// Test-only generated module: '+name);
  assets[name]=data;put(build,name,data);
 }
 put(build,'LICENSE.jgenesis','GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n');
 const manifest={
  schema:'jhadina.sega.jgenesis.unapproved-build.v1',sourceCommit:PIN,
  bridgeApi:'jhadina.sega.jgenesis.bridge.v1',operatorApproved:false,licenseReviewed:false,
  license:'GPL-3.0',files:Object.fromEntries(names.map(n=>[n,sha(assets[n])]))
 };
 put(build,'manifest.unapproved.json',JSON.stringify(manifest,null,2)+'\n');
 let x=cli('scripts/sega-review-jgenesis-artifacts.mjs',build);
 assert.equal(x.status,0,x.stderr);
 x=cli('scripts/sega-stage-preview-candidate.mjs',build,candidate);
 assert.equal(x.status,0,x.stderr);
 const sourceAssets={
  'Cargo.toml':'[workspace]\nmembers = []\n',
  'LICENSE':'GNU GENERAL PUBLIC LICENSE\n',
  'frontend/jgenesis-web/build.sh':'#!/bin/sh\n# Source build recipe\n',
  ...Object.fromEntries(MODIFIED.map(n=>[n,'// patched source: '+n+'\n']))
 };
 sourceAssets['frontend/jgenesis-web/js/ui.js']=readFileSync(SUPPORT[4]);
 sourceAssets['frontend/jgenesis-web/js/idb.js']=readFileSync(SUPPORT[5]);
 for(let i=0;i<110;i++)sourceAssets['docs/part'+i+'.txt']='fixture source file '+i;
 for(const name of BOOT_DATA)sourceAssets[name]=Buffer.from('Synthetic upstream boot data fixture: '+name);
 for(const [name,data] of Object.entries(sourceAssets))put(tree,'jgenesis/'+name,data);
 mkdirSync(source,{recursive:true});
 x=tar('-czf',join(source,'jgenesis-patched-source.tar.gz'),'-C',tree,'jgenesis');
 assert.equal(x.status,0,x.stderr);
 put(source,'jgenesis-jhadina-bridge.patch','request_save_genesis_state\n genesisStateSaved\n');
 copyFileSync(join(build,'LICENSE.jgenesis'),join(source,'LICENSE.jgenesis'));
 put(source,'REBUILD.md','UNAPPROVED source fixture; Rust nightly, wasm-pack 0.13.1\n');
 for(const path of SUPPORT)copyFileSync(path,join(source,'integration',path).replace(/(.*)\/[^/]*$/,(m,p)=>{mkdirSync(p,{recursive:true});return m}));
 const reviewRaw=readFileSync(join(build,'review.hash-receipt.json'));
 const manifestRaw=readFileSync(join(build,'manifest.unapproved.json'));
 const fileNames=['jgenesis-patched-source.tar.gz','jgenesis-jhadina-bridge.patch','LICENSE.jgenesis',
  'REBUILD.md',...SUPPORT.map(p=>'integration/'+p)];
 const proof={
  schema:'jhadina.sega.jgenesis.corresponding-source.unapproved.v1',
  sourceCommit:PIN,jhadinaSourceCommit:'a'.repeat(40),patchedSourceTree:'a'.repeat(40),reviewedFileCount:Object.keys(sourceAssets).length,
  bridgePaths:MODIFIED,licenseReviewed:false,operatorApproved:false,readyForPreview:false,
  romsIncluded:false,userGameRomsIncluded:false,saveDataIncluded:false,
  upstreamBootDataIncluded:true,
  upstreamBootBlobIds:Object.fromEntries(BOOT_DATA.map(n=>[n,blobId(Buffer.from(sourceAssets[n]))])),
  buildManifestSha256:sha(manifestRaw),
  binaryReviewReceiptSha256:sha(reviewRaw),wasmSha256:sha(assets['pkg/jgenesis_web_bg.wasm']),
  files:Object.fromEntries(fileNames.map(name=>[name,sha(readFileSync(join(source,name)))]))
 };
 put(source,'source.receipt.unapproved.json',JSON.stringify(proof,null,2)+'\n');
 x=cli('scripts/sega-verify-corresponding-source.mjs',build,source);
 assert.equal(x.status,0,x.stderr);
 x=cli('scripts/sega-verify-preview-source.mjs',build,candidate,source);
 assert.equal(x.status,0,x.stderr);
 const strict=spawnSync(process.execPath,['scripts/sega-verify-corresponding-source.mjs',build,source],{
  encoding:'utf8',env:{...process.env,JHADINA_EXPECTED_HEAD:'b'.repeat(40)}});
 assert.notEqual(strict.status,0,'Source receipt of a different Jhadina head must fail');
 let failing=cli('scripts/sega-verify-preview-source.mjs',build,candidate,join(temp,'missing-source'));
 assert.notEqual(failing.status,0,'Corresponding source is mandatory');
 put(source,'jgenesis-jhadina-bridge.patch','TAMPERED EDITS');
 failing=cli('scripts/sega-verify-corresponding-source.mjs',build,source);
 assert.notEqual(failing.status,0,'Source patch tampering denied');
 put(source,'jgenesis-jhadina-bridge.patch','request_save_genesis_state\n genesisStateSaved\n');
 const original=readFileSync(join(candidate,'vendor/pkg/jgenesis_web_bg.wasm'));
 put(candidate,'vendor/pkg/jgenesis_web_bg.wasm',Buffer.alloc(40));
 failing=cli('scripts/sega-verify-preview-source.mjs',build,candidate,source);
 assert.notEqual(failing.status,0,'Preview WASM tampering denied');
 put(candidate,'vendor/pkg/jgenesis_web_bg.wasm',original);
 put(candidate,'vendor/manifest.approved.json','{}');
 failing=cli('scripts/sega-verify-preview-source.mjs',build,candidate,source);
 assert.notEqual(failing.status,0,'Automatic approval manifest rejected');
 console.log('PASS: verified synthetic complete source, matching binary and preview; missing source/tamper/approval denied');
 console.log('Synthetic tests never establish real corresponding-source or legal compliance.');
}finally{rmSync(temp,{recursive:true,force:true})}
