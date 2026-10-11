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
 const statePtr=module._state_file_data_new(emulator);
 assert(statePtr>0,'Missing state buffer');
 try{
  module._emulator_write_state(emulator,statePtr);
  const stateBytes=module._get_file_data_size(statePtr);
  assert(stateBytes>0&&stateBytes<8*1024*1024,'Save state size outside supported bounds');
  assert.equal(module._emulator_read_state(emulator,statePtr),0,'Save-state reload failed');
 }finally{module._file_data_delete(statePtr);}

}finally{
 module._emulator_delete(emulator);
 module._free(ptr);
}
// Regression for iPhone Safari: evaluating Emulator.start(await promise, ...)
// before the class declaration throws "Cannot access 'Emulator' before initialization".
// Exercise the actual player glue against the authentic licensed ROM and WASM,
// using a deterministic iPhone-like DOM. This tests class initialization, canvas,
// touch registration, audio bootstrap, save state and cleanup (not physical Safari).
const playerCode=new Script(patched,{filename:'jhadina-simple.js'});
const romBytes=Uint8Array.from(rom).buffer;
const saved=[];
const failures=[];
let frameRequested=0;
const button={style:{},addEventListener(){},removeEventListener(){},classList:{add(){},remove(){}},getBoundingClientRect(){return {left:0,top:0,width:160,height:144}}};
const canvas={width:160,height:144,getContext(type){
  if(type!=='2d')throw new Error('Phone smoke requested unexpected renderer '+type);
  return {createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},putImageData(){}};
}};
const mockWindow={
  navigator:{userAgent:'iPhone Safari'},
  JhadinaGbBoot:{romBytes,extRamBytes:new Uint8Array(0),saveStateBytes:new Uint8Array(0)},
  JhadinaGbSaveData(kind,buffer){saved.push({kind,buffer})},
  JhadinaGbReady(){this.playerReady=true},
  JhadinaGbFailure(message){failures.push(message)},
  addEventListener(){},removeEventListener(){},
};
const browserContext={
  console,Uint8Array,Uint8ClampedArray,ArrayBuffer,Math,Promise,performance,
  document:{querySelector(sel){return sel==='canvas'?canvas:button},documentElement:{ontouchstart:null}},
  window:mockWindow,AudioContext:class {constructor(){this.sampleRate=44100;this.currentTime=0}resume(){return Promise.resolve()}suspend(){return Promise.resolve()}},
  Binjgb(){return Promise.resolve(module)},
  setInterval(){return 0},clearInterval(){},
  requestAnimationFrame(){frameRequested++;return frameRequested},cancelAnimationFrame(){},
};
playerCode.runInNewContext(browserContext);
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(failures,[],'Game Boy phone player failed during startup');
assert.equal(mockWindow.playerReady,true,'Game Boy phone player never signaled readiness');
assert(frameRequested>0,'Game Boy player never scheduled emulation frames');
assert.equal(typeof mockWindow.JhadinaGbSaveState,'function');
mockWindow.JhadinaGbSaveState();
assert(saved.some(s=>s.kind==='gbstate' && s.buffer.length>0),'Player never emitted a real save state');
mockWindow.JhadinaGbStop();
console.log('PASS: iPhone-like Game Boy player booted genuine 2048 WASM without Emulator TDZ; real save-state emitted and cleanup passed');

console.log('PASS: pinned MIT binjgb WASM instantiated, 2048.gb booted and advanced real cycles; browser/iPhone testing remains separate');
