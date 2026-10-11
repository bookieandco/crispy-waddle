#!/usr/bin/env node
/* Independently cross-check source package against exact unapproved WASM build.
 * Only verifies correspondence and absence of ROMs; does not grant GPL approval.
 * Usage: node scripts/sega-verify-corresponding-source.mjs <reviewed-build> <source-package>
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {lstatSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';

const PIN='220421984e710758cb691dcd1dd6a757ae9aca72';
const MODIFIED=['frontend/jgenesis-web/js/idb.js','frontend/jgenesis-web/js/ui.js',
 'frontend/jgenesis-web/src/audio.rs','frontend/jgenesis-web/src/config.rs',
 'frontend/jgenesis-web/src/js.rs','frontend/jgenesis-web/src/lib.rs'].sort();
const SUPPORT=['scripts/sega-prepare-jgenesis-bridge.mjs','scripts/sega-build-jgenesis-wasm.sh',
 'scripts/sega-review-jgenesis-artifacts.mjs','scripts/sega-verify-compiled-wasm.mjs',
 'apps/jhadina-web/public/gaming/sega/vendor/js/ui.js',
 'apps/jhadina-web/public/gaming/sega/vendor/js/idb.js'];
const sha=x=>createHash('sha256').update(x).digest('hex');
function walk(folder,base=folder){
 return readdirSync(folder,{withFileTypes:true}).flatMap(d=>{
  const full=join(folder,d.name),name=relative(base,full).replaceAll('\\','/');
  if(d.isSymbolicLink())throw Error('Source artifact symlink forbidden');
  if(d.isDirectory())return walk(full,base);
  if(!d.isFile())throw Error('Unexpected source package type');
  return [name];
 });
}
function safe(root,file){
 if(!/^[a-zA-Z0-9_./-]+$/.test(file)||file.includes('..')||file.startsWith('/')||file.includes('//'))
  throw Error('Unsafe source package path');
 const abs=join(root,file);
 if(lstatSync(abs).isSymbolicLink()||realpathSync(abs)!==resolve(abs))
  throw Error('Linked source artifact refused');
 return readFileSync(abs);
}
function tar(args,encoding=null){
 const x=spawnSync('tar',args,{maxBuffer:64*1024*1024,encoding});
 if(x.status!==0)throw Error('Source tar inspection failed: '+String(x.stderr).slice(0,200));
 return x.stdout;
}
function main(){
 if(process.argv.length!==4)throw Error('Usage: node scripts/sega-verify-corresponding-source.mjs <build> <source>');
 const build=resolve(process.argv[2]),source=resolve(process.argv[3]);
 const manifestRaw=readFileSync(join(build,'manifest.unapproved.json'));
 const buildReviewRaw=readFileSync(join(build,'review.hash-receipt.json'));
 const manifest=JSON.parse(manifestRaw),buildReview=JSON.parse(buildReviewRaw);
 const proofRaw=safe(source,'source.receipt.unapproved.json');
 const proof=JSON.parse(proofRaw);
 assert.equal(proof.schema,'jhadina.sega.jgenesis.corresponding-source.unapproved.v1');
 assert.equal(proof.sourceCommit,PIN);assert.equal(manifest.sourceCommit,PIN);
 assert.equal(proof.operatorApproved,false);assert.equal(proof.licenseReviewed,false);
 assert.equal(proof.readyForPreview,false);assert.equal(proof.romsIncluded,false);
 assert.equal(proof.saveDataIncluded,false);
 assert.match(proof.patchedSourceTree,/^[a-f0-9]{40}$/);
 assert.deepEqual(proof.bridgePaths,MODIFIED);
 assert(Number.isSafeInteger(proof.reviewedFileCount)&&proof.reviewedFileCount>=100);
 assert.equal(manifest.operatorApproved,false);assert.equal(manifest.licenseReviewed,false);
 assert.equal(buildReview.approvedForBrowserUse,false);
 assert.equal(buildReview.buildManifestSha256,sha(manifestRaw));
 assert.equal(proof.buildManifestSha256,sha(manifestRaw));
 assert.equal(proof.binaryReviewReceiptSha256,sha(buildReviewRaw));
 const wasmSha=sha(readFileSync(join(build,'pkg/jgenesis_web_bg.wasm')));
 assert.equal(wasmSha,manifest.files['pkg/jgenesis_web_bg.wasm']);
 assert.equal(wasmSha,buildReview.files['pkg/jgenesis_web_bg.wasm']?.sha256);
 assert.equal(proof.wasmSha256,wasmSha);
 const expected=['jgenesis-jhadina-bridge.patch','jgenesis-patched-source.tar.gz',
  'LICENSE.jgenesis','REBUILD.md','source.receipt.unapproved.json',
  ...SUPPORT.map(p=>'integration/'+p)].sort();
 assert.deepEqual(walk(source).sort(),expected,'Unexpected source package file');
 const declared=Object.keys(proof.files||{}).sort();
 assert.deepEqual(declared,expected.filter(name=>name!=='source.receipt.unapproved.json'));
 for(const name of declared){
  assert.match(proof.files[name],/^[a-f0-9]{64}$/);
  assert.equal(proof.files[name],sha(safe(source,name)),'Source hash mismatch: '+name);
 }
 assert.equal(sha(safe(source,'LICENSE.jgenesis')),sha(readFileSync(join(build,'LICENSE.jgenesis'))));
 assert(safe(source,'LICENSE.jgenesis').toString().includes('GNU GENERAL PUBLIC LICENSE'));
 const archive=join(source,'jgenesis-patched-source.tar.gz');
 const names=tar(['-tzf',archive],'utf8').split('\n').filter(Boolean);
 const contentFiles=names.filter(name=>!name.endsWith('/'));
 assert.equal(contentFiles.length,proof.reviewedFileCount,'Incomplete source archive');
 assert(contentFiles.includes('jgenesis/Cargo.toml'),'Workspace manifest missing');
 assert(contentFiles.includes('jgenesis/frontend/jgenesis-web/build.sh'),'Web build source missing');
 assert(contentFiles.includes('jgenesis/LICENSE'),'GPL source license missing');
 for(const name of names){
  if(!name.startsWith('jgenesis/')||name.includes('..')||name.includes('\\')||name.includes('//')||
     /\.(?:gen|smd|rom|iso|chd|cue|nes|gba|gbc|gb|sms|32x|mdx|bin|zip|7z|rar)$/i.test(name))
   throw Error('Unsafe or possible ROM source archive path: '+name);
 }
 const patch=safe(source,'jgenesis-jhadina-bridge.patch').toString();
 assert(patch.includes('request_save_genesis_state')&&patch.includes('genesisStateSaved'));
 for(const name of MODIFIED){
  const data=tar(['-xOzf',archive,'jgenesis/'+name]);
  if(!data.length)throw Error('Missing patched source: '+name);
  if(name.endsWith('/ui.js'))
   assert.equal(sha(data),sha(safe(source,'integration/apps/jhadina-web/public/gaming/sega/vendor/js/ui.js')));
  if(name.endsWith('/idb.js'))
   assert.equal(sha(data),sha(safe(source,'integration/apps/jhadina-web/public/gaming/sega/vendor/js/idb.js')));
 }
 console.log('PASS: independently verified full tracked source archive, six patched inputs, downstream adapters and exact WASM digest');
 console.log('DENIED: operator approval, GPL legal signoff, preview admission or release.');
}
main();
