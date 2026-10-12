/* Sega audio unlock: iOS Safari can suspend Jgenesis WebAudio when its
 * asynchronous WebGPU startup loses the initial Play user activation.
 * Capture the ONE emulator-created AudioContext without touching ROM bytes,
 * third-party runtime assets, sample generation, or verified binary hashes.
 * The Play tap may occur before audio exists; Enable sound resumes the real
 * context synchronously inside a separate, explicit user gesture.
 */
(function(root){
'use strict';
let captured=null,original=null,wrapper=null,installed=false;
let observer=null;
function status(){
 if(!root.AudioContext&&!original)return 'unsupported';
 if(!captured)return 'initializing';
 return captured.state||'unknown';
}
function announce(message){
 root.dispatchEvent?.(new root.CustomEvent('jhadina-sega:audio-status',{
  detail:{state:status(),message:message||null}
 }));
}
function restoreConstructor(){
 if(!wrapper)return;
 try{if(root.AudioContext===wrapper)root.AudioContext=original;}catch{}
 wrapper=null;
}
function attach(context){
 captured=context;
 restoreConstructor(); // Never intercept unrelated contexts after Jgenesis.
 context.addEventListener?.('statechange',()=>announce());
 announce();
}
function install(){
 if(captured)return true;
 if(installed)return Boolean(wrapper);
 const ctor=root.AudioContext;
 if(typeof ctor!=='function'){announce('Web Audio is unavailable');return false;}
 original=ctor;
 try{
  wrapper=new Proxy(ctor,{
   construct(target,args,newTarget){
    const instance=Reflect.construct(target,args,newTarget===wrapper?target:newTarget);
    attach(instance);
    return instance;
   }
  });
  root.AudioContext=wrapper;
  if(root.AudioContext!==wrapper)throw Error('AudioContext hook was rejected');
  installed=true;
  announce();
  return true;
 }catch(error){
  restoreConstructor();
  announce('Audio capture unavailable: '+String(error?.message||error));
  return false;
 }
}
function enable(){
 if(!captured){announce('Audio is still initializing. Start Sonic, then tap Enable sound.');return false;}
 if(captured.state==='running'){announce('Audio context is running');return true;}
 try{
  // IMPORTANT: call resume() synchronously from the button's click handler.
  // Awaiting a promise here can lose Safari's transient activation.
  const completion=captured.resume();
  announce('Requesting audio from Safari');
  Promise.resolve(completion).then(
   ()=>announce(captured.state==='running'?'Audio enabled':'Safari still has audio suspended'),
   error=>announce('Safari blocked audio: '+String(error?.message||error))
  );
  return true;
 }catch(error){
  announce('Audio resume failed: '+String(error?.message||error));
  return false;
 }
}
function inspect(){return {captured:!!captured,state:status(),installed};}
root.JhadinaSegaAudio=Object.freeze({install,enable,inspect});
})(globalThis);
