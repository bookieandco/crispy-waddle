import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('./',import.meta.url);
test('collector and standalone provider probes fail closed before network calls',()=>{
 for(const script of ['worker.mjs','discover.mjs','probe-tennis-shape.mjs','probe-tennis-scores.mjs']){
   const result=spawnSync(process.execPath,[new URL(script,root).pathname],{
     cwd:process.cwd(),encoding:'utf8',timeout:5000});
   assert.equal(result.status,1,script);
   assert.match(result.stderr,/SOURCE_RIGHTS_HOLD/,script);
 }
});
test('offline Week001 workflow cannot poll, publish or mutate archived evidence',()=>{
 const workflow=readFileSync(new URL('../../../../.github/workflows/jhadina-sports-lab-week001.yml',import.meta.url),'utf8');
 assert.doesNotMatch(workflow,/^  schedule:/m);
 assert.doesNotMatch(workflow,/run:\\s*node\\s+[^\\n]*worker\\.mjs/);
 assert.doesNotMatch(workflow,/publish-batch\\.mjs/);
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/offline-review\\.mjs/);
});
