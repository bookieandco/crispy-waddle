/* Jgenesis same-origin private save bridge.
 * Adapter is loaded only with reviewed, patched Jgenesis binaries.
 * SRAM is the only approved extension; BIOS and unknown files are DENIED.
 */
function active(key){
 const session=window.JhadinaSegaActive;
 if(!session||session.romFileName!==key||
    !/^gen-[a-f0-9]{24}\.md$/.test(key)||session.stopped)
  throw Error('Sega SRAM request is not bound to an active verified cartridge');
 return session;
}
export async function loadSaveFiles(key){
 const session=active(key);
 const stored=await window.JhadinaSegaSram.read({gameId:session.gameId,romSha:session.romSha});
 session.saveRevision=stored?.revision||0;
 return stored?{sav:stored.bytes.slice()}:{};
}
export async function writeSaveFile(key,extension,bytes){
 const session=active(key);
 if(extension!=='sav')throw Error('Unapproved Sega save extension');
 if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>2*1024*1024)
  throw Error('Invalid Sega SRAM data');
 const copy=bytes.slice();
 // Serialize successive WASM save callbacks; protect existing revisions.
 const next=session.saveQueue.then(async()=>{
  if(session.stopped)throw Error('Stopped Sega cartridge');
  const result=await window.JhadinaSegaSram.write({
   gameId:session.gameId,romSha:session.romSha,bytes:copy,
   expectedRevision:session.saveRevision
  });
  session.saveRevision=result.revision;
  return result;
 });
 session.saveQueue=next;
 await next;
}
export async function loadBios(_key){return null}
export async function writeBios(_key,_bytes){throw Error('Firmware installation is not supported in the Genesis lab')}
