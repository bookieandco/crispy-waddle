import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';

const sha=data=>createHash('sha256').update(data).digest('hex');
const source=mkdtempSync(join(tmpdir(),'jhadina-sega-input-'));
const empty=()=>mkdtempSync(join(tmpdir(),'jhadina-sega-output-'));
const outputs=[];
const files=[
 'js/audio-processor.js','js/idb.js','js/polyfill.js','js/ui.js',
 'pkg/jgenesis_web.js','pkg/jgenesis_web_bg.wasm',
 'pkg/snippets/jgenesis-web-0123456789abcdef/js/ui.js',
 'pkg/snippets/jgenesis-web-0123456789abcdef/js/idb.js',
 'pkg/snippets/jgenesis-web-0123456789abcdef/js/polyfill.js'
];
const assets={};
const run=(script,dir)=>spawnSync(process.execPath,[script,source,dir].filter(Boolean),{encoding:'utf8'});
try{
 for(const name of files){
  const bytes=name.endsWith('.wasm')?
   Buffer.concat([Buffer.from([0,97,115,109,1,0,0,0]),Buffer.alloc(32)]) :
   Buffer.from('// Synthetic audited preview test module: '+name);
  assets[name]=bytes;
  mkdirSync(dirname(join(source,name)),{recursive:true});
  writeFileSync(join(source,name),bytes);
 }
 writeFileSync(join(source,'LICENSE.jgenesis'),'GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n');
 const manifest={schema:'jhadina.sega.jgenesis.unapproved-build.v1',
  sourceCommit:'220421984e710758cb691dcd1dd6a757ae9aca72',
  bridgeApi:'jhadina.sega.jgenesis.bridge.v1',operatorApproved:false,
  licenseReviewed:false,license:'GPL-3.0',
  files:Object.fromEntries(files.map(name=>[name,sha(assets[name])]))};
 const writeManifest=()=>writeFileSync(join(source,'manifest.unapproved.json'),JSON.stringify(manifest,null,2)+'\n');
 const independent=()=>spawnSync(process.execPath,
  ['scripts/sega-review-jgenesis-artifacts.mjs',source],{encoding:'utf8'});
 writeManifest();
 let result=independent();assert.equal(result.status,0,result.stderr);
 const good=empty();outputs.push(good);
 result=run('scripts/sega-stage-preview-candidate.mjs',good);
 assert.equal(result.status,0,result.stderr);
 const candidate=JSON.parse(readFileSync(join(good,'preview-candidate.unapproved.json'),'utf8'));
 assert.equal(candidate.operatorApproved,false);
 assert.equal(candidate.licenseReviewed,false);
 assert.equal(candidate.readyForPreview,false);
 assert.equal(candidate.readyForProduction,false);
 assert.equal(candidate.romsIncluded,false);
 assert.equal(candidate.saveDataIncluded,false);
 assert.equal(candidate.approvedManifestEmitted,false);
 assert.deepEqual(Object.keys(candidate.files).sort(),files.sort());
 assert(!existsSync(join(good,'vendor/manifest.approved.json')),'No automated runtime approval');
 for(const name of files){
  assert.deepEqual(readFileSync(join(good,'vendor',name)),assets[name]);
 }
 // A changed binary must be refused before any file is staged.
 writeFileSync(join(source,'pkg/jgenesis_web_bg.wasm'),Buffer.alloc(40));
 const badBinary=empty();outputs.push(badBinary);
 result=run('scripts/sega-stage-preview-candidate.mjs',badBinary);
 assert.notEqual(result.status,0);
 assert.equal(existsSync(join(badBinary,'vendor')),false);
 writeFileSync(join(source,'pkg/jgenesis_web_bg.wasm'),assets['pkg/jgenesis_web_bg.wasm']);
 // An unexpected private ROM (or any extra file) is never copied.
 writeFileSync(join(source,'my-private-cartridge.md'),Buffer.alloc(1024));
 const badExtra=empty();outputs.push(badExtra);
 result=run('scripts/sega-stage-preview-candidate.mjs',badExtra);
 assert.notEqual(result.status,0);
 assert.equal(existsSync(join(badExtra,'vendor')),false);
 rmSync(join(source,'my-private-cartridge.md'));
 // A forged approved flag must not be mistaken for operator license review.
 manifest.operatorApproved=true;writeManifest();
 const fakeApproved=empty();outputs.push(fakeApproved);
 result=run('scripts/sega-stage-preview-candidate.mjs',fakeApproved);
 assert.notEqual(result.status,0);
 assert.equal(existsSync(join(fakeApproved,'vendor')),false);
 console.log('PASS: staging requires exact independent hash receipt and denies ROMs, altered bytes and fake approval');
 console.log('NO approved manifest or real preview was created.');
}finally{
 rmSync(source,{recursive:true,force:true});
 for(const dir of outputs)rmSync(dir,{recursive:true,force:true});
}
