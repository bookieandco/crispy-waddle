import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';

const path='apps/jhadina-web/public/gaming/sega/acceptance.js';
const source=readFileSync(path,'utf8');
new Script(source,{filename:path});
const observations=()=>({graphicsVisible:false,audioHeard:false,controlsWorked:false,saveResumeWorked:false});
const callbacks=new Map(),checkboxes=new Map(),events=[];
let manifestOK=false,canvas=false,active=false,adapter=false,landscape=false;
const root={
 navigator:{userAgent:'Test iPhone; no private tokens'},
 innerWidth:800,innerHeight:390,Blob,
 URL:{createObjectURL:()=>{events.push('object-url');return 'blob:private-device'},revokeObjectURL:()=>events.push('revoke')},
 setTimeout:(fn)=>{fn();return 1},
 addEventListener:(name,fn)=>callbacks.set(name,fn),
 matchMedia:()=>({matches:landscape}),
 document:{
  getElementById:id=>{
   if(id==='jgenesis-wasm')return {querySelector:()=>canvas?{}:null};
   return checkboxes.get(id)||null;
  },
  createElement:()=>({click:()=>events.push('download'),remove:()=>events.push('remove')}),
  body:{append:()=>events.push('append')}
 },
 JhadinaSegaDevice:{
  inspect:async()=>({
   secureContext:true,crossOriginIsolated:true,webAssembly:true,
   webGPUAdapter:adapter,touchAvailable:true
  })
 },
 JhadinaSegaRuntime:{
  verifyManifest:async()=>{
   if(!manifestOK)throw Error('Approved Sega engine not installed');
   return {files:{'pkg/jgenesis_web_bg.wasm':'c'.repeat(64)}};
  }
 }
};
runInNewContext(source,root);
const device=root.JhadinaSegaAcceptance;
const empty=await device.buildEvidence({observations:observations()});
assert.equal(empty.schema,'jhadina.sega.iphone-acceptance.evidence.v1');
assert.equal(empty.certified,false);
assert.equal(empty.romBytesIncluded,false);assert.equal(empty.saveBytesIncluded,false);
assert.equal(empty.runtime.approvedManifestVerified,false);
assert.equal(empty.hardware.canvasPresent,false);
assert(empty.missingEvidence.includes('WebGPU adapter'));
assert(empty.missingEvidence.includes('operator observation: graphicsVisible'));
await assert.rejects(()=>device.buildEvidence({observations:{graphicsVisible:true}}),/Explicit per-item/);
for(const [name,v] of Object.entries(observations()))checkboxes.set('observed-'+name,{checked:v});
const fromForm=device.observationsFromForm(root.document);
assert.deepEqual({...fromForm},observations());
for(const key of Object.keys(fromForm))checkboxes.get('observed-'+key).checked=true;
manifestOK=canvas=active=adapter=landscape=true;
root.JhadinaSegaActive={stopped:false,gameId:'gen-'+'a'.repeat(24),romSha:'a'.repeat(64)};
callbacks.get('jhadina-sega:rom-loaded')();
const verified=await device.buildEvidence({observations:device.observationsFromForm(root.document)});
assert.equal(verified.runtime.approvedManifestVerified,true);
assert.equal(verified.runtime.engineSha256,'c'.repeat(64));
assert.equal(verified.runtime.romLoadedEventObserved,true);
assert.equal(verified.hardware.canvasPresent,true);
assert.equal(verified.hardware.landscape,true);
assert.equal(verified.operatorObservations.saveResumeWorked,true);
assert.equal(verified.certified,false,'Operator checkboxes NEVER grant certification');
assert(verified.missingEvidence.includes('independent physical-device visual/audio evidence'));
assert(verified.missingEvidence.some(s=>s.includes('license')));
assert(!JSON.stringify(verified).includes(root.JhadinaSegaActive.romSha),'No cartridge fingerprints in receipts');
const downloaded=await device.downloadEvidence({observations:device.observationsFromForm(root.document)});
assert.equal(downloaded.certified,false);
assert(events.includes('download'));
assert(events.includes('revoke'));
console.log('PASS: local iPhone evidence export, honest capability checks, explicit observations and no false certification');
