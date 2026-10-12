/* Private Sega Web Audio controls and diagnostics.
 * User gesture unlock is separate from audio sample verification. No external
 * ROM, binary, or audio assets. Do not claim that a running context is audible.
 */
(function(root){
'use strict';
let captured=null,original=null,wrapper=null,installed=false;
let primed=null,primedTaken=false,primeError=null;
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
function prepareFromGesture(){
 // A game launch performs async IndexedDB, SHA-256, import() and WebGPU
 // initialization before Rust constructs AudioContext. In Safari that is
 // too late for autoplay activation. Create and resume the exact 48 kHz
 // context synchronously from the trusted Play click and hand it to Rust
 // later when wasm-bindgen invokes new AudioContext({sampleRate:48000}).
 if(captured)return enable();
 const Ctor=original||root.AudioContext||root.webkitAudioContext;
 if(typeof Ctor!=='function'){
  primeError='Web Audio unsupported';announce(primeError);return false;
 }
 try{
  if(!primed||primed.state==='closed'){
   const candidate=new Ctor({sampleRate:48000});
   if(candidate.sampleRate&&Math.round(candidate.sampleRate)!==48000){
    void candidate.close?.();
    throw Error('48 kHz emulator audio not supported by this device');
   }
   primed=candidate;
   // A short silent source exercises the output pipeline inside the same
   // tap. Silence is not proof of audible sound or gameplay.
   if(typeof candidate.createOscillator==='function'&&typeof candidate.createGain==='function'){
    const tone=candidate.createOscillator(),gain=candidate.createGain();
    gain.gain.value=0;
    tone.connect(gain);gain.connect(candidate.destination);
    tone.start();tone.stop(candidate.currentTime+.02);
    tone.addEventListener?.('ended',()=>{
     try{tone.disconnect();gain.disconnect()}catch{}
    },{once:true});
   }
  }
  const completion=primed.resume();
  Promise.resolve(completion).then(
   ()=>announce('Game audio pre-armed on Play tap: '+primed.state),
   error=>announce('Game audio pre-arm rejected: '+String(error?.message||error))
  );
  primeError=null;
  announce('Game audio context created on Play tap; waiting for Jgenesis');
  return true;
 }catch(error){
  primeError=String(error?.message||error);
  announce('Game audio pre-arm unavailable: '+primeError);
  return false;
 }
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
    // Reuse the context that Safari authorized on the Play gesture.
    // It is not reused for any other constructor call.
    const instance=primed&&!primedTaken&&primed.state!=='closed'?
     primed:Reflect.construct(target,args,newTarget===wrapper?target:newTarget);
    if(instance===primed)primedTaken=true;
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
let testContext=null,testStatus='not-tested';
function testSpeaker(){
 // Independent device-route test. Use a fresh AudioContext CREATED directly
 // by the tap, not Jgenesis's potentially starved/suspended worklet context.
 const Ctor=original||root.AudioContext||root.webkitAudioContext;
 if(typeof Ctor!=='function'){
  testStatus='unsupported';announce('Independent speaker test: Web Audio unsupported');return false;
 }
 try{
  if(testContext&&testContext.state==='closed')testContext=null;
  const context=testContext||new Ctor();
  testContext=context;
  const oscillator=context.createOscillator(),gain=context.createGain();
  oscillator.type='sine';oscillator.frequency.value=660;
  gain.gain.value=.15;
  oscillator.connect(gain);gain.connect(context.destination);
  const start=context.currentTime;
  gain.gain.setValueAtTime(.15,start);
  gain.gain.exponentialRampToValueAtTime(.001,start+.55);
  oscillator.start(start);oscillator.stop(start+.58);
  oscillator.addEventListener?.('ended',()=>{
   try{oscillator.disconnect();gain.disconnect()}catch{}
  },{once:true});
  // Resume without awaiting; Safari needs both start and resume within tap.
  const promise=context.resume();
  Promise.resolve(promise).then(()=>{
   testStatus=context.state==='running'?'running':'blocked';
   announce('Independent speaker test '+testStatus+'. Did you hear the beep?');
  },error=>{
   testStatus='blocked: '+String(error?.message||error);
   announce('Independent speaker test '+testStatus);
  });
  testStatus='requested';
  announce('Independent 660 Hz tone queued for 0.55s; media volume up');
  return true;
 }catch(error){
  testStatus='error: '+String(error?.message||error);
  announce('Independent speaker test '+testStatus);return false;
 }
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
  workletFault,graphFault,peak,signalDetected:peak!==null&&peak>.002,
  independentSpeakerState:testContext?.state||testStatus,
  prearmed:!!primed,prearmedUsed:primedTaken,primeError};
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
root.JhadinaSegaAudio=Object.freeze({install,prepareFromGesture,enable,testSpeaker,inspect,check});
})(globalThis);
