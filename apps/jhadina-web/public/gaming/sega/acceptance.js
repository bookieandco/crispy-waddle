/* Operator-initiated, ROM-free iPhone acceptance evidence.
 * This produces a LOCAL downloadable receipt, not gameplay certification.
 * It does not upload diagnostics, ROMs, saves or device identifiers.
 */
(function(root){
'use strict';
const SCHEMA='jhadina.sega.iphone-acceptance.evidence.v1';
const SOURCE='220421984e710758cb691dcd1dd6a757ae9aca72';
const KEYS=Object.freeze(['graphicsVisible','audioHeard','controlsWorked','saveResumeWorked']);
let loadedEvent=false;
root.addEventListener('jhadina-sega:rom-loaded',()=>{loadedEvent=true});
function observationsFromForm(doc){
 const result={};
 for(const name of KEYS){
  const input=doc.getElementById('observed-'+name);
  result[name]=input?.checked===true;
 }
 return result;
}
async function buildEvidence({observations}={}){
 if(!observations||typeof observations!=='object'||
    KEYS.some(name=>typeof observations[name]!=='boolean'))
  throw Error('Explicit per-item operator observations required');
 const device=await root.JhadinaSegaDevice.inspect();
 let manifestVerified=false,manifestSha=null,manifestError=null;
 // This checks full same-origin binary fingerprints but DOES NOT boot a ROM.
 try{
  const manifest=await root.JhadinaSegaRuntime.verifyManifest();
  manifestVerified=true;
  manifestSha=manifest.files?.['pkg/jgenesis_web_bg.wasm']||null;
 }catch(err){manifestError=String(err?.message||err).slice(0,180)}
 const canvas=root.document.getElementById('jgenesis-wasm')?.querySelector('canvas');
 const session=root.JhadinaSegaActive;
 const sessionActive=Boolean(session&&!session.stopped);
 const landscape=root.matchMedia?.('(orientation: landscape)')?.matches===true;
 // Observations are self-reported, NEVER silently upgraded to objective proof.
 const evidence={
  schema:SCHEMA,sourceCommit:SOURCE,
  recordedAt:new Date().toISOString(),reviewOnly:true,certified:false,
  collection:'manual-local-download',romBytesIncluded:false,saveBytesIncluded:false,
  hardware:{
   secureContext:device.secureContext===true,
   crossOriginIsolated:device.crossOriginIsolated===true,
   wasm:device.webAssembly===true,webGpuAdapter:device.webGPUAdapter===true,
   touch:device.touchAvailable===true,
   landscape,canvasPresent:Boolean(canvas),
   viewportWidth:Number(root.innerWidth)||0,viewportHeight:Number(root.innerHeight)||0,
   userAgent:String(root.navigator?.userAgent||'').slice(0,220)
  },
  runtime:{
   approvedManifestVerified:manifestVerified,
   engineSha256:manifestSha,
   manifestError:manifestError,
   romLoadedEventObserved:loadedEvent,
   activeCartridgeSession:sessionActive
  },
  operatorObservations:Object.fromEntries(KEYS.map(name=>[name,observations[name]])),
  missingEvidence:[
   'independent physical-device visual/audio evidence',
   'operator review of GPL licensing and preview distribution',
   ...(!manifestVerified?['approved runtime binary']:[]),
   ...(!device.webGPUAdapter?['WebGPU adapter']:[]),
   ...(!landscape?['landscape orientation']:[]),
   ...(!canvas?['created game canvas']:[]),
   ...(!loadedEvent?['ROM loaded event']:[]),
   ...(!sessionActive?['active cartridge session']:[]),
   ...KEYS.filter(name=>!observations[name]).map(name=>'operator observation: '+name)
  ],
  notes:'Checks are browser observations plus explicit human reports. This file alone never authorizes production, legal license approval or ROM distribution.'
 };
 return Object.freeze(evidence);
}
async function downloadEvidence({observations}){
 const report=await buildEvidence({observations});
 const data=JSON.stringify(report,null,2);
 const href=root.URL.createObjectURL(new root.Blob([data],{type:'application/json'}));
 try{
  const a=root.document.createElement('a');
  a.href=href;a.download='jhadina-sega-iphone-evidence-'+new Date().toISOString().slice(0,10)+'.json';
  root.document.body.append(a);a.click();a.remove();
 }finally{root.setTimeout(()=>root.URL.revokeObjectURL(href),10000)}
 return report;
}
root.JhadinaSegaAcceptance=Object.freeze({buildEvidence,downloadEvidence,observationsFromForm,keys:KEYS});
})(globalThis);
