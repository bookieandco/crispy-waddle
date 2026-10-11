import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext,Script} from 'node:vm';
const dir='apps/jhadina-web/public/vendor/binjgb/approved/';
const manifest=JSON.parse(readFileSync(dir+'manifest.json','utf8'));
assert.equal(manifest.schema,'jhadina.gaming.binjgb.verified.v1');
assert.equal(manifest.sourceCommit,'16621111ed0ee73bcc45c912a823bcebedcffc0f');
assert.equal(manifest.license,'MIT');
function blobSha(buffer){return createHash('sha1').update('blob '+buffer.length).update(Uint8Array.of(0)).update(buffer).digest('hex');}
for(const [name,sha] of [['binjgb.js',manifest.originalJsBlob],['binjgb.wasm',manifest.originalWasmBlob]]){
 assert.equal(blobSha(readFileSync(dir+name)),sha,'Vendored upstream binary changed: '+name);
}
for(const license of ['LICENSE','LICENSE.gbstudio'])assert(readFileSync(dir+license,'utf8').includes('Permission is hereby granted'));
const wasm=readFileSync(dir+'binjgb.wasm');
assert.equal(wasm.subarray(0,4).toString('hex'),'0061736d','WASM magic mismatch');
const source=readFileSync(dir+'binjgb.js','utf8');
new Script(source,{filename:'binjgb.js'});
const patched=readFileSync(dir+'jhadina-simple.js','utf8');
new Script(patched,{filename:'jhadina-simple.js'});
assert(!patched.includes('localStorage'),'Private saves must not leak across games');
assert(patched.includes('window.JhadinaGbSaveData'),'No save-state bridge');
const env={console,WebAssembly,Uint8Array,Uint16Array,Uint32Array,Int8Array,Int32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array,TextDecoder,TextEncoder,ArrayBuffer,DataView,Math,Promise,URL,setTimeout,clearTimeout,performance};
runInNewContext(source,env,{filename:'binjgb.js'});
assert.equal(typeof env.Binjgb,'function');
const module=await env.Binjgb({wasmBinary:new Uint8Array(wasm)});
const rom=readFileSync('apps/jhadina-web/public/gaming/gameboy/homebrew/2048.gb');
const ptr=module._malloc(rom.length);
assert(ptr>0);
module.HEAPU8.set(rom,ptr);
const emulator=module._emulator_new_simple(ptr,rom.length,44100,4096,2);
assert(emulator>0,'Bundled 2048 ROM must boot in the real WebAssembly core');
try{
 const now=module._emulator_get_ticks_f64(emulator);
 assert(Number.isFinite(now));
 module._emulator_run_until_f64(emulator,now+250000);
 const after=module._emulator_get_ticks_f64(emulator);
 assert(after>now,'Actual GB core did not advance');
 const imagePtr=module._get_frame_buffer_ptr(emulator);
 const imageSize=module._get_frame_buffer_size(emulator);
 assert(imagePtr>0&&imageSize>100,'No Game Boy frame buffer');
 module._set_joyp_up(emulator,1);module._set_joyp_up(emulator,0);
}finally{
 module._emulator_delete(emulator);
 module._free(ptr);
}
console.log('PASS: pinned MIT binjgb WASM instantiated, 2048.gb booted and advanced real cycles; browser/iPhone testing remains separate');
