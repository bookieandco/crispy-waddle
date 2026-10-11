#!/usr/bin/env node
/* ROM-free preview SOURCE admission (review candidate only, NOT deployment approval).
 * Requires independently verified binary plus full patched source and GPL notice.
 * Usage: node scripts/sega-verify-preview-source.mjs <build> <preview-candidate> <corresponding-source>
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const sha=x=>createHash('sha256').update(x).digest('hex');
function main(){
 if(process.argv.length!==5)throw Error('Usage: node scripts/sega-verify-preview-source.mjs <build> <candidate> <corresponding-source>');
 const build=resolve(process.argv[2]),candidate=resolve(process.argv[3]),source=resolve(process.argv[4]);
 if(!existsSync(join(source,'source.receipt.unapproved.json')))
  throw Error('Corresponding source package required before preview review');
 const result=spawnSync(process.execPath,
  ['scripts/sega-verify-corresponding-source.mjs',build,source],{encoding:'utf8',maxBuffer:2*1024*1024});
 if(result.status!==0)throw Error('Corresponding source verification failed: '+String(result.stderr||'').slice(0,500));
 const manifestRaw=readFileSync(join(build,'manifest.unapproved.json'));
 const buildReceiptRaw=readFileSync(join(build,'review.hash-receipt.json'));
 const proof=JSON.parse(readFileSync(join(source,'source.receipt.unapproved.json')));
 const manifest=JSON.parse(manifestRaw);
 const preview=JSON.parse(readFileSync(join(candidate,'preview-candidate.unapproved.json')));
 assert.equal(preview.schema,'jhadina.sega.preview-candidate.v1');
 for(const field of ['operatorApproved','licenseReviewed','readyForPreview','readyForProduction','romsIncluded','saveDataIncluded','approvedManifestEmitted'])
  assert.equal(preview[field],false,'Preview candidate cannot grant '+field);
 if(existsSync(join(candidate,'vendor','manifest.approved.json')))
  throw Error('Unapproved review candidate must not contain browser admission manifest');
 assert.equal(preview.sourceCommit,proof.sourceCommit);
 assert.equal(preview.manifestSha256,proof.buildManifestSha256);
 assert.equal(preview.manifestSha256,sha(manifestRaw));
 assert.equal(preview.hashReceiptSha256,proof.binaryReviewReceiptSha256);
 assert.equal(preview.hashReceiptSha256,sha(buildReceiptRaw));
 assert.equal(preview.wasmSha256,proof.wasmSha256);
 assert.equal(preview.wasmSha256,sha(readFileSync(join(candidate,'vendor/pkg/jgenesis_web_bg.wasm'))));
 assert.deepEqual(Object.keys(preview.files).sort(),Object.keys(manifest.files).sort());
 for(const [name,hash] of Object.entries(preview.files)){
  assert.equal(hash,manifest.files[name]);
  assert.equal(sha(readFileSync(join(candidate,'vendor',name))),hash,'Preview executable differs from reviewed WASM: '+name);
 }
 console.log('PASS: source-matched ROM-free preview REVIEW candidate and binary correspondence');
 console.log('DENIED: license signoff, manifest approval, preview deployment and gameplay certification');
}
main();
