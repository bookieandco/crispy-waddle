#!/usr/bin/env node
/* Offline, ROM-free, deny-by-default Sega preview candidate preparation.
 * Never creates manifest.approved.json or deploys to a server.
 * Usage: node scripts/sega-stage-preview-candidate.mjs <unapproved-build-dir> <empty-output-dir>
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const PIN='220421984e710758cb691dcd1dd6a757ae9aca72';
const REPO=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const BASE=['js/audio-processor.js','js/idb.js','js/polyfill.js','js/ui.js',
 'pkg/jgenesis_web.js','pkg/jgenesis_web_bg.wasm'];
const META=['LICENSE.jgenesis','manifest.unapproved.json','review.hash-receipt.json'];
const sha=data=>createHash('sha256').update(data).digest('hex');
const inside=(base,path)=>path===base||path.startsWith(base+sep);
function walk(base,dir=base){
 const entries=readdirSync(dir,{withFileTypes:true});
 return entries.flatMap(entry=>{
  const full=join(dir,entry.name);
  if(entry.isSymbolicLink())throw Error('Symbolic links forbidden in Sega build');
  if(entry.isDirectory())return walk(base,full);
  if(!entry.isFile())throw Error('Unexpected artifact kind');
  return [relative(base,full).split(sep).join('/')];
 });
}
function readSafe(root,name){
 if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..')||name.startsWith('/')||name.includes('//'))
  throw Error('Unsafe preview artifact path: '+name);
 const file=join(root,name);
 if(!inside(root,resolve(file)))throw Error('Preview artifact escaped root');
 if(realpathSync(file)!==resolve(file)||lstatSync(file).isSymbolicLink())
  throw Error('Symlink encountered in artifact path');
 return readFileSync(file);
}
function main(){
 if(process.argv.length!==4)throw Error('Usage: node scripts/sega-stage-preview-candidate.mjs <build> <empty-output>');
 const source=realpathSync(resolve(process.argv[2]));
 const output=resolve(process.argv[3]);
 if(inside(source,output)||inside(output,source)||inside(REPO,output)||inside(output,REPO))
  throw Error('Preview candidate must be outside repository and source');
 if(existsSync(output)&&(lstatSync(output).isSymbolicLink()||readdirSync(output).length))
  throw Error('Preview candidate destination must be empty and not a symlink');
 const manifestBytes=readSafe(source,'manifest.unapproved.json');
 const manifest=JSON.parse(manifestBytes.toString('utf8'));
 const receiptBytes=readSafe(source,'review.hash-receipt.json');
 const receipt=JSON.parse(receiptBytes.toString('utf8'));
 const license=readSafe(source,'LICENSE.jgenesis');
 assert.equal(manifest.schema,'jhadina.sega.jgenesis.unapproved-build.v1');
 assert.equal(manifest.sourceCommit,PIN);
 assert.equal(manifest.bridgeApi,'jhadina.sega.jgenesis.bridge.v1');
 assert.equal(manifest.operatorApproved,false);
 assert.equal(manifest.licenseReviewed,false);
 assert.equal(manifest.license,'GPL-3.0');
 assert.equal(receipt.schema,'jhadina.sega.jgenesis.independent-hash-review.v1');
 assert.equal(receipt.reviewedSourceCommit,PIN);
 assert.equal(receipt.approvedForBrowserUse,false);
 assert.equal(receipt.buildManifestSha256,sha(manifestBytes));
 assert.equal(receipt.licenseSha256,sha(license));
 assert(license.toString('utf8').includes('GNU GENERAL PUBLIC LICENSE'));
 const files=Object.keys(manifest.files||{}).sort();
 const snippets=files.filter(x=>x.startsWith('pkg/snippets/'));
 if(snippets.length<3||snippets.length>20||
    !['ui.js','idb.js','polyfill.js'].every(name=>snippets.some(x=>x.endsWith('/js/'+name)))||
    !snippets.every(x=>/^pkg\/snippets\/[a-zA-Z0-9_./-]+\.js$/.test(x)&&!x.includes('..')&&!x.includes('//')))
  throw Error('Unsafe or incomplete Jgenesis module set');
 assert.deepEqual(files,[...BASE,...snippets].sort(),'Unreviewed executable in manifest');
 assert.deepEqual(Object.keys(receipt.files||{}).sort(),files,'Independent receipt file set differs');
 assert.deepEqual(walk(source).sort(),[...META,...files].sort(),'Unknown file in build');
 for(const name of files){
  const data=readSafe(source,name),digest=sha(data);
  if(!/^[a-f0-9]{64}$/.test(manifest.files[name])||
     manifest.files[name]!==digest||receipt.files[name]?.sha256!==digest||
     receipt.files[name]?.bytes!==data.length)
   throw Error('Build/receipt content mismatch: '+name);
  if(name.endsWith('.wasm')&&data.subarray(0,4).toString('hex')!=='0061736d')
   throw Error('WASM header invalid');
 }
 // Only after a full validation do any output files get written.
 mkdirSync(output,{recursive:true});
 for(const name of files){
  const dest=join(output,'vendor',name);
  mkdirSync(dirname(dest),{recursive:true});
  copyFileSync(join(source,name),dest);
 }
 for(const name of META)copyFileSync(join(source,name),join(output,name));
 const candidate={
  schema:'jhadina.sega.preview-candidate.v1',sourceCommit:PIN,
  operatorApproved:false,licenseReviewed:false,readyForPreview:false,
  readyForProduction:false,romsIncluded:false,saveDataIncluded:false,
  approvedManifestEmitted:false,manifestSha256:sha(manifestBytes),
  hashReceiptSha256:sha(receiptBytes),licenseSha256:sha(license),
  wasmSha256:manifest.files['pkg/jgenesis_web_bg.wasm'],
  files:Object.fromEntries(files.map(name=>[name,manifest.files[name]])),
  openGates:['Independent GPL distribution review','Operator preview approval',
   'Protected HTTPS preview verification','Physical iPhone graphics/audio/input/save-state acceptance'],
  note:'No manifest.approved.json is generated; copying this directory to a web root does not admit the emulator.'
 };
 writeFileSync(join(output,'preview-candidate.unapproved.json'),JSON.stringify(candidate,null,2)+'\n');
 if(existsSync(join(output,'vendor','manifest.approved.json')))throw Error('Forbidden auto-approval');
 console.log('PASS: exact source, files, independent receipt and GPL notice; ROM-free preview candidate staged');
 console.log('DENIED: no approved manifest, no deployment, no physical-device certification');
}
main();
