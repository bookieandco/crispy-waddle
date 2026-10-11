#!/usr/bin/env node
/* Read-only binary-level Jgenesis smoke for unapproved artifacts.
 * No ROM, network, GPU instantiation, approval or deployment.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const BASE=process.argv[2];
if(!BASE)throw Error('Usage: node scripts/sega-verify-compiled-wasm.mjs /private/jgenesis-review');
const root=resolve(BASE);
const manifest=JSON.parse(readFileSync(join(root,'manifest.unapproved.json'),'utf8'));
assert.equal(manifest.schema,'jhadina.sega.jgenesis.unapproved-build.v1');
assert.equal(manifest.operatorApproved,false,'This is a non-approval smoke');
assert.equal(manifest.sourceCommit,'220421984e710758cb691dcd1dd6a757ae9aca72');
const artifact=name=>{
 if(!Object.hasOwn(manifest.files,name)||name.includes('..')||name.startsWith('/'))throw Error('Unmanifested binary asset: '+name);
 const destination=join(root,name);
 assert(!relative(root,destination).startsWith('..'));
 const data=readFileSync(destination);
 assert.equal(createHash('sha256').update(data).digest('hex'),manifest.files[name]);
 return data;
};
const wasm=artifact('pkg/jgenesis_web_bg.wasm');
const engine=await WebAssembly.compile(wasm);
const exports=WebAssembly.Module.exports(engine);
for(const required of ['emulatorchannel_request_open_verified_rom','emulatorchannel_request_genesis_input']){
 assert(exports.some(x=>x.kind==='function'&&x.name===required),'Missing wasm-bindgen export '+required);
}
const wrapper=artifact('pkg/jgenesis_web.js').toString('utf8');
for(const symbol of ['request_open_verified_rom(rom_file_name, rom)','request_genesis_input(button, pressed)','run_emulator(config_ref, emulator_channel)']){
 assert(wrapper.includes(symbol),'Missing browser bridge function '+symbol);
}
const relativeSnippet=/['"](\.\/snippets\/[^'"\n]+\.js)['"]/g;
const declared=new Set();
for(const match of wrapper.matchAll(relativeSnippet)){
 const name='pkg/'+match[1].slice(2);
 assert(/^pkg\/snippets\/[\w.-]+\/js\/[\w.-]+\.js$/.test(name),'Unapproved JS snippet import');
 artifact(name);declared.add(name);
}
for(const item of ['idb.js','ui.js','polyfill.js']){
 assert([...declared].some(x=>x.endsWith('/'+item)),'Missing embedded Jgenesis '+item+' snippet');
}
const worklet=artifact('js/audio-processor.js').toString('utf8');
assert(worklet.includes('"../pkg/jgenesis_web.js"'),'Unexpected worklet runtime import');
assert(worklet.includes('registerProcessor("audio-processor"'),'Audio worklet registration missing');
console.log('PASS: compiled '+wasm.length+' WASM bytes; verified '+declared.size+' owned JS snippet imports and Genesis bridge exports');
console.log('NOT a rendering, audio, Sonic boot, license approval or iPhone acceptance test.');
