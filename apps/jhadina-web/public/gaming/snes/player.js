/* Jhadina SNES owner-only lab. No bundled cartridges, BIOS, remote ROM URLs,
 * automatic external runtime/CDN, or server-side upload. Self-hosted EmulatorJS
 * 4.2.3 must be staged separately from an archive with an approved SHA-256.
 */
(function(root){
'use strict';
const $=id=>root.document.getElementById(id);
const DATA='/vendor/emulatorjs/approved/data/';
const MANIFEST='/vendor/emulatorjs/approved/manifest.json';
const VERSION='v4.2.3';
const ARCHIVE_SHA='07d451bc06fa3ad04ab30d9b94eb63ac34ad0babee52d60357b002bde8f3850b';
const MAX_ROM=8*1024*1024,MAX_ZIP=12*1024*1024;
let selected=null,selectedHash='',started=false,blobUrl=null;
function say(message){$('status').textContent=String(message);}
function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
async function digest(bytes){return hex(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)));}
function u16(b,p){if(p<0||p+2>b.length)throw Error('ZIP truncated');return b[p]|b[p+1]<<8;}
function u32(b,p){if(p<0||p+4>b.length)throw Error('ZIP truncated');return (b[p]+b[p+1]*256+b[p+2]*65536+b[p+3]*16777216)>>>0;}
function validName(name){return /^[a-zA-Z0-9 ._()[\]!+-]{1,180}\.(?:smc|sfc)$/i.test(name)&&!name.includes('..');}
function inspectZip(b){
 if(b.length<30||b.length>MAX_ZIP)throw Error('ZIP size unsupported (12 MB max)');
 let end=-1;
 for(let p=b.length-22;p>=Math.max(0,b.length-65557);p--){
  if(u32(b,p)===0x06054b50&&p+22+u16(b,p+20)===b.length){end=p;break;}
 }
 if(end<0||u16(b,end+4)!==0||u16(b,end+6)!==0)throw Error('Unsupported ZIP directory');
 const count=u16(b,end+10),start=u32(b,end+16),length=u32(b,end+12);
 if(count!==1||u16(b,end+8)!==1||start+length!==end)throw Error('ZIP must contain exactly one SNES ROM');
 if(u32(b,start)!==0x02014b50||start+46>end)throw Error('ZIP central entry invalid');
 const flags=u16(b,start+8),method=u16(b,start+10),compressed=u32(b,start+20),size=u32(b,start+24);
 const nameLength=u16(b,start+28),extra=u16(b,start+30),comment=u16(b,start+32),local=u32(b,start+42);
 if(flags&1||flags&64||![0,8].includes(method))throw Error('Encrypted or unsupported ZIP');
 if(size<32768||size>MAX_ROM||compressed>MAX_ZIP)throw Error('ZIP ROM size is invalid');
 if(start+46+nameLength+extra+comment!==end||nameLength>180)throw Error('ZIP directory inconsistent');
 const name=new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(start+46,start+46+nameLength));
 if(!validName(name))throw Error('ZIP must contain one safe .smc or .sfc name at its root');
 if(u32(b,local)!==0x04034b50||u16(b,local+8)!==method||u16(b,local+6)!==flags)throw Error('ZIP local entry invalid');
 const ln=u16(b,local+26),le=u16(b,local+28);
 if(ln!==nameLength||local+30+ln+le+compressed>start)throw Error('ZIP bytes overlap directory');
 const a=b.subarray(local+30,local+30+ln),c=b.subarray(start+46,start+46+nameLength);
 if(!a.every((byte,i)=>byte===c[i]))throw Error('ZIP entry filename mismatch');
 return {gameName:name,romBytes:size};
}
async function checkFile(file){
 if(!file||!/(\.sfc|\.smc|\.zip)$/i.test(file.name))throw Error('Choose .smc, .sfc or ZIP');
 if(file.size<32||file.size>MAX_ZIP)throw Error('Cartridge file size unsupported');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const zip=/\.zip$/i.test(file.name);
 let gameName=file.name;
 if(zip)gameName=inspectZip(bytes).gameName;
 else{
  if(!validName(file.name)||bytes.length<32768||bytes.length>MAX_ROM)throw Error('SNES cartridge size/name invalid');
  // SMC copier headers (512 bytes) are accepted by the SNES core.
  if(!([0,512].includes(bytes.length%1024)))throw Error('SNES ROM length does not match a supported cartridge layout');
 }
 return {file,gameName,sha:await digest(bytes)};
}
async function runtimeReady(){
 if(!root.isSecureContext||!root.crypto?.subtle)throw Error('HTTPS and WebCrypto are required');
 const manifestResponse=await root.fetch(MANIFEST,{credentials:'same-origin',cache:'no-store',redirect:'error'});
 if(!manifestResponse.ok)throw Error('Self-hosted SNES core is not installed. See operator handoff; no CDN fallback');
 const m=await manifestResponse.json();
 if(m?.schema!=='jhadina.gaming.emulatorjs.approved.v1'||m.version!==VERSION||
  m.archiveSha256!==ARCHIVE_SHA||!m.coreIds?.includes('snes')||!/^[a-f0-9]{64}$/.test(m.loaderSha256)||
  m.dataPath!==DATA)throw Error('Untrusted or unsupported SNES runtime manifest');
 const response=await root.fetch(DATA+'loader.js',{credentials:'same-origin',cache:'no-store',redirect:'error'});
 if(!response.ok||response.type==='opaque')throw Error('Local EmulatorJS loader missing');
 if(await digest(await response.arrayBuffer())!==m.loaderSha256)throw Error('EmulatorJS loader SHA-256 mismatch');
 return true;
}
function prepareRuntime(game){
 if(started)throw Error('Reload this page to change cartridges');
 const b=root.URL.createObjectURL(game.file);
 blobUrl=b;
 // Runtime uses an explicit SNES core, a browser-local blob URL and its
 // own documented mobile virtual SNES controls and save-state UI.
 root.EJS_player='#game';
 root.EJS_core='snes';
 root.EJS_controlScheme='snes';
 root.EJS_gameUrl=b;
 root.EJS_gameName=game.gameName.replace(/\.(sfc|smc)$/i,'').slice(0,80);
 root.EJS_gameID=parseInt(game.sha.slice(0,7),16);
 root.EJS_pathtodata=DATA;
 root.EJS_startOnLoaded=false; // Player's own Play button is a real audio gesture.
 root.EJS_browserMode='mobile';
 root.EJS_volume=1;
 root.EJS_color='#b89cf1';
 root.EJS_onGameStart=function(){say('SNES reported game start; verify sound, graphics and every button on your iPhone');};
 root.EJS_onExit=function(){say('SNES session exited. Select a file and reload to restart.');};
 $('ready').hidden=true;$('game').style.display='block';
 const script=root.document.createElement('script');
 script.src=DATA+'loader.js';script.async=false;script.crossOrigin='anonymous';
 script.onerror=()=>{say('SNES loader failed to execute; no game was uploaded.');};
 root.document.body.appendChild(script);
 started=true;
}
$('rom').addEventListener('change',async event=>{
 if(started){say('Reload the page to switch cartridges.');return;}
 const file=event.target.files?.[0];if(!file)return;
 $('boot').disabled=true;say('Checking local cartridge structure and SHA-256…');
 try{
  const result=await checkFile(file);
  selected=result;selectedHash=result.sha;
  $('boot').disabled=false;$('boot').textContent='Load '+result.gameName;
  say('Local cartridge verified · SHA-256 '+selectedHash.slice(0,12)+'… · press Load');
 }catch(error){
  selected=null;selectedHash='';say('Import blocked: '+String(error.message||error));
 }
});
$('boot').addEventListener('click',async()=>{
 if(!selected||started)return;
 $('boot').disabled=true;say('Verifying self-hosted emulator integrity…');
 try{await runtimeReady();prepareRuntime(selected);}
 catch(error){say(String(error.message||error));$('boot').disabled=false;}
});
$('expand').addEventListener('click',()=>{
 const immersive=$('app').classList.toggle('immersive');
 $('expand').textContent=immersive?'Normal size':'Bigger screen';
 $('expand').setAttribute('aria-pressed',String(immersive));
});
$('portraitChoose').addEventListener('click',()=>{$('rom').click();});
$('speaker').addEventListener('click',()=>{
 // Runs synchronously inside the user gesture. This tests Safari speaker
 // output ONLY, not the emulator's own worklet/audio pipeline.
 const Ctor=root.AudioContext||root.webkitAudioContext;
 if(!Ctor){say('Web Audio unavailable in this browser');return;}
 let ctx;
 try{
  ctx=new Ctor();
  const tone=ctx.createOscillator(),gain=ctx.createGain();
  tone.type='sine';tone.frequency.value=523.25;
  gain.gain.setValueAtTime(0.0001,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.11,ctx.currentTime+0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.24);
  tone.connect(gain);gain.connect(ctx.destination);
  tone.start();tone.stop(ctx.currentTime+0.26);
  // Deliberately do not await before calling resume() in Safari.
  void Promise.resolve(ctx.resume()).catch(error=>say('Safari audio resume rejected: '+error.message));
  tone.onended=()=>{tone.disconnect();gain.disconnect();void ctx.close().catch(()=>{});};
  say('Speaker tone requested. Did you hear a short beep? This does not verify SNES game audio.');
 }catch(error){if(ctx)void ctx.close().catch(()=>{});say('Speaker check failed: '+String(error.message||error));}
});
root.addEventListener('pagehide',()=>{if(blobUrl)root.URL.revokeObjectURL(blobUrl);});
})(window);
