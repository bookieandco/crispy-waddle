/* ROM-bound Genesis save/load coordinator.
 * Owns the entire async transaction, not only the WASM event.
 * No ROM bytes, networking, or backup credentials.
 */
(function(root){
'use strict';
function create({session,channel,states,capture,restore}){
 if(!session||!channel||!states||typeof capture!=='function'||typeof restore!=='function')
  throw Error('Incomplete Genesis save-state coordinator');
 let busy=false;
 function ready(){
  if(session.stopped||session.loaded!==true)throw Error('Genesis cartridge not ready for save/resume');
 }
 async function exclusive(work){
  if(busy)throw Error('A Genesis save/resume operation is already running');
  ready();
  busy=true;
  try{return await work()}
  finally{busy=false}
 }
 async function saveState(){
  return exclusive(async()=>{
   const reply=await capture(channel);
   ready(); // Runtime failure or cartridge exit during capture must reject persistence.
   if(!(reply?.bytes instanceof Uint8Array))
    throw Error('Invalid WASM Genesis save-state response');
   const result=await states.write({
    gameId:session.gameId,romSha:session.romSha,
    bytes:reply.bytes,expectedRevision:session.stateRevision
   });
   session.stateRevision=result.revision;
   return result;
  });
 }
 async function loadState(){
  return exclusive(async()=>{
   const stored=await states.read({gameId:session.gameId,romSha:session.romSha});
   ready(); // Do not restore into an emulator that exited while IndexedDB was reading.
   if(!stored)throw Error('No Genesis save state for this cartridge');
   await restore(channel,stored.bytes);
   ready();
   session.stateRevision=stored.revision;
   return {revision:stored.revision,size:stored.bytes.length};
  });
 }
 return Object.freeze({saveState,loadState});
}
root.JhadinaSegaStateCoordinator=Object.freeze({create});
})(globalThis);
