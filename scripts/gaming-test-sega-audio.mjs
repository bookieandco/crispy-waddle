import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
const path='apps/jhadina-web/public/gaming/sega/audio-unlock.js';
const source=readFileSync(path,'utf8');
new Script(source,{filename:path});
const browserEvents=[];
let actualResumeCalls=0,gesture=false;
class FakeAudioContext {
 constructor(){
  this.state='suspended';
  this.listeners=new Map();
 }
 addEventListener(type,cb){this.listeners.set(type,cb)}
 resume(){
  actualResumeCalls++;
  if(!gesture)return Promise.reject(Error('NotAllowedError: user gesture required'));
  this.state='running';
  this.listeners.get('statechange')?.();
  return Promise.resolve();
 }
}
class FakeCustomEvent extends Event {
 constructor(name,options){super(name);this.detail=options?.detail}
}
const root={
 AudioContext:FakeAudioContext,CustomEvent:FakeCustomEvent,
 dispatchEvent(event){browserEvents.push(event.detail);}
};
runInNewContext(source,root);
const audio=root.JhadinaSegaAudio;
assert.equal(audio.inspect().state,'initializing');
assert.equal(audio.install(),true,'Install before async WebGPU initialization');
assert.notEqual(root.AudioContext,FakeAudioContext,'Constructor must be captured before WASM init');
assert.equal(audio.enable(),false,'Never create a fake audio context when startup is incomplete');
const ctx=new root.AudioContext({sampleRate:48000});
assert.equal(root.AudioContext,FakeAudioContext,'Global constructor must be restored after capture');
assert.equal(audio.inspect().captured,true);
assert.equal(audio.inspect().state,'suspended');
assert.equal(actualResumeCalls,0);
gesture=true;
assert.equal(audio.enable(),true,'Explicit user click must request audio resume');
assert.equal(actualResumeCalls,1,'resume() must run synchronously in the click turn');
await Promise.resolve();
assert.equal(ctx.state,'running');
assert.equal(audio.inspect().state,'running');
assert.equal(audio.install(),true,'Repeated setup must not replace captured AudioContext');
assert.equal(audio.enable(),true);
assert.equal(actualResumeCalls,1,'Already-running AudioContext must not be needlessly resumed');
assert(browserEvents.some(e=>e?.state==='running'));
const broken={AudioContext:null,CustomEvent:FakeCustomEvent,dispatchEvent(){}};
runInNewContext(source,broken);
assert.equal(broken.JhadinaSegaAudio.install(),false,'Unsupported WebAudio must fail safely');
assert.equal(broken.JhadinaSegaAudio.enable(),false);
// Verify an actual Jgenesis AudioWorkletNode is captured without modifying
// the original destination path. This is a mock signal, not Sonic playback.
let signal=.28,connections=[],speakerStarted=0;
class BrowserAudioContext extends FakeAudioContext{
 constructor(){super();this.currentTime=12;this.destination={name:'speaker'};}
 createAnalyser(){return {fftSize:2048,
  connect(node){connections.push(['analyser',node])},
  getFloatTimeDomainData(data){data.fill(0);data[10]=signal}
 }}
 createGain(){return {gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},
  connect(node){connections.push(['gain',node])},disconnect(){}}
 }
 createOscillator(){return {type:'sine',frequency:{value:0},
  connect(node){connections.push(['oscillator',node])},
  start(){speakerStarted++},stop(){},disconnect(){},addEventListener(){}}
 }
}
class BrowserWorklet{
 constructor(context,name){this.context=context;this.name=name;}
 connect(node){connections.push(['worklet',node]);return node}
 addEventListener(){}
}
const testHost={AudioContext:BrowserAudioContext,AudioWorkletNode:BrowserWorklet,
 CustomEvent:FakeCustomEvent,dispatchEvent(event){browserEvents.push(event.detail)}
};
runInNewContext(source,testHost);
const diagnostic=testHost.JhadinaSegaAudio;
assert.equal(diagnostic.install(),true);
const gameContext=new testHost.AudioContext();
const gameNode=new testHost.AudioWorkletNode(gameContext,'audio-processor');
assert.equal(testHost.AudioWorkletNode,BrowserWorklet,
 'Monitor must restore original AudioWorkletNode constructor');
assert.equal(diagnostic.inspect().worklet,true);
assert.equal(diagnostic.inspect().signalDetected,true,'Nonzero simulated output detected');
assert(connections.some(pair=>pair[0]==='worklet'),'Monitor must connect signal analyser');
signal=0;
assert.equal(diagnostic.check().signalDetected,false,'Do not claim game sound on silence');
assert.equal(diagnostic.testSpeaker(),true,'Gesture may test device speakers independently');
assert.equal(diagnostic.inspect().independentSpeakerState,'running',
 'Independent test audio context must enter running state');
assert.equal(gameContext.state,'suspended',
 'Independent speaker test must not silently reuse/activate Jgenesis AudioContext');
assert.equal(speakerStarted,1,'Speaker test oscillator must start on click without await');
assert.equal(diagnostic.inspect().state,'suspended','Speaker diagnostics must not alter game audio state');
const html=readFileSync('apps/jhadina-web/public/gaming/sega/index.html','utf8');
const app=readFileSync('apps/jhadina-web/public/gaming/sega/app.js','utf8');
const runtime=readFileSync('apps/jhadina-web/public/gaming/sega/runtime-loader.js','utf8');
const middleware=readFileSync('apps/jhadina-web/src/lib/supabase/middleware.ts','utf8');
assert(html.includes('id="enableSound"'),'Visible iOS sound control is required');
assert(html.includes('id="zoomScreen"')&&html.includes('id="soundCheck"')&&html.includes('id="testSpeaker"'));
assert(app.includes("layout.style.setProperty('--sega-zoom',String(value))"),'Actual game zoom must update on-screen image');
assert(app.includes('JhadinaSegaAudio?.check()')&&app.includes('JhadinaSegaAudio?.testSpeaker()'));
assert(html.includes('transform:scale(var(--sega-zoom,1.12))'),'Zoom must scale the real game canvas');

assert(html.includes('/gaming/sega/audio-unlock.js'),'The audio unlock script must be loaded');
assert(html.indexOf('/gaming/sega/audio-unlock.js')<html.indexOf('/gaming/sega/runtime-loader.js'));
assert(runtime.indexOf('root.JhadinaSegaAudio?.install();')<runtime.indexOf('module.run_emulator(config,channel.clone())'),
 'Capture must be armed before Jgenesis asynchronously creates audio context');
assert(app.includes("soundButton.addEventListener('click',()=>{"),'Gesture must be wired directly');
assert(app.includes("window.JhadinaSegaAudio?.enable()"),'Gesture must synchronously resume captured context');
assert(middleware.includes('"/gaming/sega/audio-unlock.js"'),'The sound unlock script must be public through route middleware');
assert(!source.includes('fetch('),'Audio control must not download assets or game data');
console.log('PASS: iOS WebAudio captures authentic Jgenesis context, restores constructor, resumes synchronously on tap, reports actual state, route allowed');
console.log('Phone speaker output and actual Genesis samples require manual Safari confirmation');
