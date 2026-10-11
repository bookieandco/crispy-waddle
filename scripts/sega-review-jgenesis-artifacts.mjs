#!/usr/bin/env node
// Offline independent check of *unapproved* Jgenesis output; never grants approval.
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync,lstatSync,realpathSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';

const PIN='220421984e710758cb691dcd1dd6a757ae9aca72';
const EXACT=[
 'js/audio-processor.js','js/idb.js','js/polyfill.js','js/ui.js',
 'pkg/jgenesis_web.js','pkg/jgenesis_web_bg.wasm'
];
const LICENSE='LICENSE.jgenesis';
const SCHEMA='jhadina.sega.jgenesis.unapproved-build.v1';
const sha=x=>createHash('sha256').update(x).digest('hex');
if(process.argv.length!==3)throw Error('Usage: node scripts/sega-review-jgenesis-artifacts.mjs /private/build-output');
const folder=resolve(process.argv[2]);
function fromDir(name){
 const abs=join(folder,name),rel=relative(folder,abs);
 if(rel.startsWith('..')||rel.startsWith('/')||lstatSync(abs).isSymbolicLink())
  throw Error('Unsafe or linked artifact path');
 if(realpathSync(abs)!==abs)throw Error('Artifact directory cannot contain symlinks');
 return readFileSync(abs);
}
const input=JSON.parse(fromDir('manifest.unapproved.json').toString('utf8'));
if(input.schema!==SCHEMA||input.sourceCommit!==PIN||
 input.bridgeApi!=='jhadina.sega.jgenesis.bridge.v1'||
 input.operatorApproved!==false||input.licenseReviewed!==false||
 input.license!=='GPL-3.0'||typeof input.files!=='object'||!input.files)
 throw Error('Invalid or approved-in-disguise source build');
const found=Object.keys(input.files).sort();
if(found.join('|')!==EXACT.join('|'))throw Error('Artifact set mismatch');
for(const path of ['js','pkg']){
 const names=readdirSync(join(folder,path)).sort();
 const expected=EXACT.filter(n=>n.startsWith(path+'/')).map(n=>n.split('/')[1]).sort();
 if(names.join('|')!==expected.join('|'))throw Error('Unexpected files in '+path);
}
const manifestFiles={};
for(const name of EXACT){
 const data=fromDir(name);
 if(data.length<16||data.length>48*1024*1024)throw Error('Unsafe artifact file size: '+name);
 const digest=sha(data);
 if(!/^[a-f0-9]{64}$/.test(input.files[name])||digest!==input.files[name])
  throw Error('SHA-256 mismatch: '+name);
 manifestFiles[name]={sha256:digest,bytes:data.length};
 if(name.endsWith('.wasm')&&data.subarray(0,4).toString('hex')!=='0061736d')
  throw Error('Invalid WASM header');
}
const license=fromDir(LICENSE);
if(!license.toString('utf8').includes('GNU GENERAL PUBLIC LICENSE'))
 throw Error('Missing GNU GPL license text');
const receipt={
 schema:'jhadina.sega.jgenesis.independent-hash-review.v1',
 reviewedSourceCommit:PIN,
 approvedForBrowserUse:false,
 buildManifestSha256:sha(fromDir('manifest.unapproved.json')),
 licenseSha256:sha(license),
 files:manifestFiles,
 note:'Hash and source provenance check only. Operator/license/security/iPhone acceptance is NOT granted.'
};
writeFileSync(join(folder,'review.hash-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log('PASS: inspected six pinned Jgenesis artifacts, WASM magic, GPL notice and SHA-256');
console.log('Output is STILL UNAPPROVED:',join(folder,'review.hash-receipt.json'));
