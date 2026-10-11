import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=mkdtempSync(join(tmpdir(),'sega-review-'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const names=[
 'js/audio-processor.js','js/idb.js','js/polyfill.js','js/ui.js',
 'pkg/jgenesis_web.js','pkg/jgenesis_web_bg.wasm'
];
try{
 mkdirSync(join(root,'js'));mkdirSync(join(root,'pkg'));
 const blobs={};
 for(const name of names){
  const data=name.endsWith('.wasm')
   ?Buffer.concat([Buffer.from([0,97,115,109,1,0,0,0]),Buffer.alloc(16)])
   :Buffer.from('// synthetic audited JS module for '+name,'utf8');
  blobs[name]=data;
  writeFileSync(join(root,name),data);
 }
 writeFileSync(join(root,'LICENSE.jgenesis'),'GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n');
 const manifest={
  schema:'jhadina.sega.jgenesis.unapproved-build.v1',
  sourceCommit:'220421984e710758cb691dcd1dd6a757ae9aca72',
  bridgeApi:'jhadina.sega.jgenesis.bridge.v1',
  operatorApproved:false,licenseReviewed:false,license:'GPL-3.0',
  files:Object.fromEntries(names.map(n=>[n,sha(blobs[n])]))
 };
 const saveManifest=()=>writeFileSync(join(root,'manifest.unapproved.json'),JSON.stringify(manifest,null,2)+'\n');
 const check=()=>spawnSync(process.execPath,['scripts/sega-review-jgenesis-artifacts.mjs',root],{encoding:'utf8'});
 saveManifest();
 let result=check();assert.equal(result.status,0,result.stderr);
 const receipt=JSON.parse(readFileSync(join(root,'review.hash-receipt.json'),'utf8'));
 assert.equal(receipt.approvedForBrowserUse,false);
 assert.equal(Object.keys(receipt.files).length,6);
 writeFileSync(join(root,'pkg/jgenesis_web_bg.wasm'),Buffer.alloc(24));
 result=check();assert.notEqual(result.status,0);
 assert.match(result.stderr,/SHA-256 mismatch/);
 writeFileSync(join(root,'pkg/jgenesis_web_bg.wasm'),blobs['pkg/jgenesis_web_bg.wasm']);
 manifest.operatorApproved=true;saveManifest();
 result=check();assert.notEqual(result.status,0);
 assert.match(result.stderr,/approved-in-disguise/);
 manifest.operatorApproved=false;saveManifest();
 writeFileSync(join(root,'js/unreviewed.js'),'unreviewed');
 result=check();assert.notEqual(result.status,0);
 assert.match(result.stderr,/Unexpected files/);
}finally{rmSync(root,{recursive:true,force:true})}
console.log('PASS: independent Jgenesis build-review digest receipt; tamper, unauthorized approval and extra artifact denied');
