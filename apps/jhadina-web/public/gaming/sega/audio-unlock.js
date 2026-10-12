/* Private Sega Web Audio controls and diagnostics.
 * User gesture unlock is separate from audio sample verification. No external
 * ROM, binary, or audio assets. Do not claim that a running context is audible.
 */
(function(root){
'use strict';
let captured=null,original=null,wrapper=null,installed=false;
let originalWorklet=null,wrappedWorklet=null,worklet=null,analyser=null;
let workletFault=null,graphFault=null;
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
function restoreWorklet(){
 if(!wrappedWorklet)return;
 try{if(root.AudioWorkletNode===wrappedWorklet)root.AudioWorkletNode=originalWorklet;}catch{}
 wrappedWorklet=null;
}
function attachWorklet(node){
 worklet=node;
 restoreWorklet();
 node.addEventListener?.('processorerror',()=>{
  workletFault='AudioWorklet processorerror: emulator audio processing stopped';
  announce(workletFault);
 });
 try{
  const context=node.context||captured;
  if(!context?.createAnalyser||!context?.createGain)throw Error('Analyser unavailable');
  const monitor=context.createAnalyser();monitor.fftSize=2048;
  const silent=context.createGain();silent.gain.value=0;
  // A zero-gain analysis branch does not replace, modify or double the
  // Jgenesis output connection to the physical destination.
  node.connect(monitor);monitor.connect(silent);silent.connect(context.destination);
  analyser=monitor;
 }catch(error){graphFault=String(error?.message||error)}
 announce('Jgenesis audio worklet attached');
}
function installWorkletMonitor(){
 const ctor=root.AudioWorkletNode;
 if(typeof ctor!=='function'||wrappedWorklet)return;
 originalWorklet=ctor;
 try{
  wrappedWorklet=new Proxy(ctor,{
   construct(target,args,newTarget){
    const node=Reflect.construct(target,args,newTarget===wrappedWorklet?target:newTarget);
    if(args[1]==='audio-processor')attachWorklet(node);
    return node;
   }
  });
  root.AudioWorkletNode=wrappedWorklet;
  if(root.AudioWorkletNode!==wrappedWorklet)throw Error('AudioWorkletNode monitor rejected');
 }catch(error){
  restoreWorklet();
  graphFault='Audio worklet monitoring unavailable: '+String(error?.message||error);
 }
}
function attach(context){
 captured=context;
 restoreConstructor(); // Jgenesis owns this one audio context.
 context.addEventListener?.('statechange',()=>announce());
 announce('Jgenesis AudioContext created');
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
  installWorkletMonitor();
  announce();
  return true;
 }catch(error){
  restoreConstructor();
  restoreWorklet();
  announce('Audio capture unavailable: '+String(error?.message||error));
  return false;
 }
}
function enable(){
 if(!captured){announce('Audio has not initialized. Start Sonic first.');return false;}
 if(captured.state==='running'){announce('Audio context is running; this does not confirm game sound');return true;}
 try{
  // MUST happen synchronously during a trusted iPhone tap; do not await.
  const completion=captured.resume();
  announce('Requesting audio playback from Safari');
  Promise.resolve(completion).then(
   ()=>announce(captured.state==='running'?'Audio context running; run Sound check for game audio':'Safari still has audio suspended'),
   error=>announce('Safari blocked audio: '+String(error?.message||error))
  );
  return true;
 }catch(error){
  announce('Audio resume failed: '+String(error?.message||error));
  return false;
 }
}
function testSpeaker(){
 if(!captured){announce('Start Sonic before speaker test');return false;}
 try{
  // The device test tone is deliberately NOT a game-audio certification.
  // User must say whether the audible 0.2s tone actually played.
  enable();
  const oscillator=captured.createOscillator();
  const gain=captured.createGain();
  oscillator.type='sine';oscillator.frequency.value=440;
  gain.gain.value=.045;
  oscillator.connect(gain);gain.connect(captured.destination);
  const start=captured.currentTime;
  gain.gain.setValueAtTime(.045,start);
  gain.gain.exponentialRampToValueAtTime(.001,start+.20);
  oscillator.start(start);oscillator.stop(start+.22);
  oscillator.addEventListener?.('ended',()=>{oscillator.disconnect();gain.disconnect()},{once:true});
  announce('440 Hz test tone queued. Did you hear a short beep?');
  return true;
 }catch(error){announce('Speaker test failed: '+String(error?.message||error));return false;}
}
function inspect(){
 let peak=null;
 if(analyser?.getFloatTimeDomainData){
  try{
   const samples=new Float32Array(analyser.fftSize||2048);
   analyser.getFloatTimeDomainData(samples);
   peak=samples.reduce((m,v)=>Math.max(m,Math.abs(v)),0);
  }catch(error){graphFault=String(error?.message||error)}
 }
 return {captured:!!captured,state:status(),installed,worklet:!!worklet,
  workletFault,graphFault,peak,signalDetected:peak!==null&&peak>.002};
}
function check(){
 const value=inspect();
 let message;
 if(!value.captured)message='No Jgenesis AudioContext observed';
 else if(value.state!=='running')message='AudioContext '+value.state+' — tap Enable sound';
 else if(value.workletFault)message=value.workletFault;
 else if(!value.worklet)message='AudioContext running, but no Jgenesis AudioWorkletNode captured';
 else if(value.peak===null)message='Audio context running; worklet found; output meter unavailable'+(value.graphFault?': '+value.graphFault:'');
 else message=value.signalDetected?'Worklet output samples detected (speaker not yet verified)':
   'Worklet connected but no nonzero samples detected at this instant';
 announce(message);
 return {...value,message};
}
root.JhadinaSegaAudio=Object.freeze({install,enable,testSpeaker,inspect,check});
})(globalThis);
