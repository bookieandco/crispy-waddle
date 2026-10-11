#!/usr/bin/env node
/* Full patched corresponding source for source-pinned Jgenesis, never approval.
 * Usage: node scripts/sega-package-corresponding-source.mjs <patched-checkout> <reviewed-build> <empty-output>
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdtempSync,mkdirSync,openSync,closeSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const PIN='220421984e710758cb691dcd1dd6a757ae9aca72';
const MODIFIED=['frontend/jgenesis-web/js/idb.js','frontend/jgenesis-web/js/ui.js',
 'frontend/jgenesis-web/src/audio.rs','frontend/jgenesis-web/src/config.rs',
 'frontend/jgenesis-web/src/js.rs','frontend/jgenesis-web/src/lib.rs'].sort();
const UPSTREAM_BOOT_DATA=Object.freeze({
 'backend/s32x-core/src/m68k_vectors.bin':'b4582fe452d7267af731b5cff9dd932e9464dbb9',
 'backend/s32x-core/src/sh2_master_boot_rom.bin':'67cdda465d9ee1de5bf99ade943c8de22017eb12',
 'backend/s32x-core/src/sh2_slave_boot_rom.bin':'6c53ae5aa9c49317b334533f3683649fa01631d3'
});
const SUPPORT=['scripts/sega-prepare-jgenesis-bridge.mjs','scripts/sega-build-jgenesis-wasm.sh',
 'scripts/sega-review-jgenesis-artifacts.mjs','scripts/sega-verify-compiled-wasm.mjs',
 'apps/jhadina-web/public/gaming/sega/vendor/js/ui.js',
 'apps/jhadina-web/public/gaming/sega/vendor/js/idb.js'];
const REPO=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=data=>createHash('sha256').update(data).digest('hex');
const fileHash=path=>sha(readFileSync(path));
const within=(parent,child)=>child===parent||child.startsWith(parent+sep);
function cmd(exe,args,opt={}){
 const x=spawnSync(exe,args,{encoding:'utf8',maxBuffer:16*1024*1024,...opt});
 if(x.status!==0)throw Error(exe+' '+args.slice(0,3).join(' ')+': '+String(x.stderr||'').slice(0,700));
 return String(x.stdout||'').trim();
}
function git(root,...args){return cmd('git',['-C',root,...args]);}
function main(){
 if(process.argv.length!==5)throw Error('Usage: node scripts/sega-package-corresponding-source.mjs <checkout> <build> <empty-output>');
 const root=resolve(process.argv[2]),build=resolve(process.argv[3]),output=resolve(process.argv[4]);
 for(const folder of [root,build,REPO])if(within(folder,output)||within(output,folder))
  throw Error('Source output must be outside source and build trees');
 if(existsSync(output)&&readdirSync(output).length)throw Error('Source output must be empty');
 assert.equal(git(root,'rev-parse','HEAD'),PIN,'Unpinned Jgenesis source');
 assert.deepEqual(git(root,'diff','--name-only').split('\n').filter(Boolean).sort(),MODIFIED);
 if(git(root,'diff','--cached','--name-only'))throw Error('Unexpected staged source changes');
 git(root,'diff','--check');
 const manifestRaw=readFileSync(join(build,'manifest.unapproved.json'));
 const reviewRaw=readFileSync(join(build,'review.hash-receipt.json'));
 const manifest=JSON.parse(manifestRaw.toString()),review=JSON.parse(reviewRaw.toString());
 assert.equal(manifest.schema,'jhadina.sega.jgenesis.unapproved-build.v1');
 assert.equal(manifest.sourceCommit,PIN);assert.equal(manifest.operatorApproved,false);
 assert.equal(manifest.licenseReviewed,false);
 assert.equal(review.schema,'jhadina.sega.jgenesis.independent-hash-review.v1');
 assert.equal(review.reviewedSourceCommit,PIN);assert.equal(review.approvedForBrowserUse,false);
 assert.equal(review.buildManifestSha256,sha(manifestRaw));
 assert.equal(review.files['pkg/jgenesis_web_bg.wasm']?.sha256,manifest.files['pkg/jgenesis_web_bg.wasm']);
 assert.equal(fileHash(join(build,'pkg/jgenesis_web_bg.wasm')),manifest.files['pkg/jgenesis_web_bg.wasm']);
 assert.equal(fileHash(join(build,'LICENSE.jgenesis')),review.licenseSha256);
 mkdirSync(output,{recursive:true});
 const scratch=mkdtempSync(join(tmpdir(),'jhadina-sega-source-'));
 try{
  // A separate Git index hashes the exact patched tree without touching HEAD
  // or staging changes in the original upstream checkout.
  const env={...process.env,GIT_INDEX_FILE:join(scratch,'index')};
  cmd('git',['-C',root,'read-tree','HEAD'],{env});
  cmd('git',['-C',root,'add','--',...MODIFIED],{env});
  const tree=cmd('git',['-C',root,'write-tree'],{env});
  const tracked=git(root,'ls-tree','-r',tree).split('\n').filter(Boolean);
  if(tracked.length<100)throw Error('Incomplete upstream corresponding-source tree');
  for(const entry of tracked){
   const m=/^([0-7]{6}) blob ([0-9a-f]{40})\t(.+)$/.exec(entry);
   if(!m||!['100644','100755'].includes(m[1]))throw Error('Unsafe tracked Git entry');
   const name=m[3];
   if(name.startsWith('/')||name.includes('..')||name.includes('\\')||/[\x00-\x1f]/.test(name))
    throw Error('Unsafe source filename: '+name);
   if(name.toLowerCase().endsWith('.bin')){
    if(UPSTREAM_BOOT_DATA[name]!==m[2])throw Error('Unreviewed upstream boot firmware blob: '+name);
   }else if(/\.(?:gen|smd|rom|iso|chd|cue|nes|gba|gbc|gb|sms|32x|mdx|zip|7z|rar)$/i.test(name))
    throw Error('Potential game ROM or media binary in tracked source: '+name);
   if(name.toLowerCase().endsWith('.md')){
    const data=spawnSync('git',['-C',root,'cat-file','blob',m[2]],{maxBuffer:20*1024*1024});
    if(data.status!==0||data.stdout.includes(0))throw Error('Binary Markdown/cartridge in source: '+name);
   }
  }
  const patch=git(root,'diff','--binary','HEAD','--',...MODIFIED)+'\n';
  if(!patch.includes('request_save_genesis_state')||!patch.includes('genesisStateSaved'))
   throw Error('Reviewed save-state patch absent');
  writeFileSync(join(output,'jgenesis-jhadina-bridge.patch'),patch);
  const tar=join(scratch,'patched-source.tar');
  cmd('git',['-C',root,'archive','--format=tar','--prefix=jgenesis/','--output='+tar,tree]);
  const gz=join(output,'jgenesis-patched-source.tar.gz'),fd=openSync(gz,'w');
  try{cmd('gzip',['-n','-9','-c',tar],{stdio:['ignore',fd,'pipe']});}
  finally{closeSync(fd)}
  for(const path of SUPPORT){
   const dest=join(output,'integration',path);
   mkdirSync(dirname(dest),{recursive:true});
   copyFileSync(join(REPO,path),dest);
  }
  copyFileSync(join(build,'LICENSE.jgenesis'),join(output,'LICENSE.jgenesis'));
  const rebuild=[
   '# Jhadina Sega corresponding source (UNAPPROVED)','',
   'Pinned upstream: jsgroth/jgenesis @ '+PIN,'Patched Git tree: '+tree,'',
   'Extract jgenesis-patched-source.tar.gz to recover the full tracked patched',
   'Jgenesis source, Cargo manifests, frontend build scripts and GPL license.',
   'The six-file bridge patch is provided separately for review.',
   'Jhadina adapter JS, bridge preparation and build/verification scripts live in integration/.',
   'Rebuild with rustup nightly (rust-src + wasm32-unknown-unknown),',
   'wasm-pack 0.13.1, Node and Bash using frontend/jgenesis-web/build.sh.',
   'The Rust nightly is not pinned to a date: binary-identical builds are not guaranteed.',
   'No user-supplied games or save data. Three pinned upstream 32X boot-data blobs are included.',
   'Review the provenance and distribution rights of those upstream boot blobs independently.',
   'This artifact does not approve browser preview or production.'
  ].join('\n')+'\n';
  writeFileSync(join(output,'REBUILD.md'),rebuild);
  const files=['jgenesis-jhadina-bridge.patch','jgenesis-patched-source.tar.gz',
   'LICENSE.jgenesis','REBUILD.md',...SUPPORT.map(p=>'integration/'+p)];
  const receipt={
   schema:'jhadina.sega.jgenesis.corresponding-source.unapproved.v1',
   sourceCommit:PIN,patchedSourceTree:tree,reviewedFileCount:tracked.length,
   bridgePaths:MODIFIED,licenseReviewed:false,operatorApproved:false,
   readyForPreview:false,romsIncluded:false,userGameRomsIncluded:false,saveDataIncluded:false,
   upstreamBootDataIncluded:true,upstreamBootBlobIds:UPSTREAM_BOOT_DATA,
   buildManifestSha256:sha(manifestRaw),binaryReviewReceiptSha256:sha(reviewRaw),
   wasmSha256:manifest.files['pkg/jgenesis_web_bg.wasm'],
   files:Object.fromEntries(files.map(name=>[name,fileHash(join(output,name))])),
   note:'Patched source includes three pinned upstream 32X boot-data blobs (not user game ROMs); separate distribution review required.'
  };
  writeFileSync(join(output,'source.receipt.unapproved.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log('PASS: source tree '+tree+' with matching binary receipt, three pinned upstream boot blobs, no owner games');
  console.log('DENIED: license/preview approval, production changes or deployment.');
 }finally{rmSync(scratch,{recursive:true,force:true})}
}
main();
