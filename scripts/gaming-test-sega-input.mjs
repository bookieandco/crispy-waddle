import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext, Script} from 'node:vm';

const source=readFileSync('apps/jhadina-web/public/gaming/sega/input-adapter.js','utf8');
new Script(source,{filename:'input-adapter.js'});
const context={};
runInNewContext(source,context);
const messages=[],domEvents={};let frame=null,canceled=null;
const buttons=new Map();
for(const name of ['up','down','left','right','a','b','c','x','y','z','start','mode']){
 const events={};
 const el={
  disabled:true,
  getAttribute:()=>name,
  addEventListener:(type,fn)=>events[type]=fn,
  removeEventListener:(type,fn)=>{if(events[type]===fn)delete events[type]},
  setPointerCapture:()=>{},
  events
 };
 buttons.set(name,el);
}
const docEvents={};
const document={
 querySelectorAll:()=>Array.from(buttons.values()),
 querySelector:()=>null,
 addEventListener:(type,fn)=>docEvents[type]=fn,
 removeEventListener:(type,fn)=>{if(docEvents[type]===fn)delete docEvents[type]},
 hidden:false
};
let gamepad=null;
const host={
 document,navigator:{getGamepads:()=>gamepad?[gamepad]:[]},
 addEventListener:(type,fn)=>domEvents[type]=fn,
 removeEventListener:(type,fn)=>{if(domEvents[type]===fn)delete domEvents[type]},
 requestAnimationFrame:cb=>{frame=cb;return 7},
 cancelAnimationFrame:id=>{canceled=id;frame=null}
};
const controller=context.JhadinaSegaInput.create({host,onInput:msg=>messages.push({button:msg.button,pressed:msg.pressed})});
assert.equal(controller.isActive(),false);
assert([...buttons.values()].every(el=>el.disabled));
buttons.get('a').events.pointerdown({pointerId:1,preventDefault(){}});
assert.equal(messages.length,0,'No input without admitted emulator runtime');
controller.activate();
assert.equal(controller.isActive(),true);
assert([...buttons.values()].every(el=>!el.disabled));
buttons.get('a').events.pointerdown({pointerId:1,preventDefault(){}});
assert.deepEqual(messages.at(-1),{button:'a',pressed:true});
domEvents.keydown({type:'keydown',code:'KeyZ',repeat:false,preventDefault(){},target:{closest:()=>null}});
assert.equal(messages.length,1,'Two input sources should not double-press A');
buttons.get('a').events.pointercancel({pointerId:1});
assert.equal(messages.length,1,'Releasing touch should preserve held keyboard A');
domEvents.keyup({type:'keyup',code:'KeyZ',preventDefault(){}});
assert.deepEqual(messages.at(-1),{button:'a',pressed:false});
// iPhone multi-touch: holding Down and Jump must produce two independent
// inputs. A lost capture must never leave Sonic crouching indefinitely.
buttons.get('down').events.pointerdown({pointerId:27,preventDefault(){}});
assert.deepEqual(messages.at(-1),{button:'down',pressed:true});
buttons.get('b').events.pointerdown({pointerId:28,preventDefault(){}});
assert.deepEqual(messages.at(-1),{button:'b',pressed:true});
assert.equal(typeof domEvents.pointerup,'function');
domEvents.pointerup({pointerId:27}); // Safari release outside captured button
assert.deepEqual(messages.at(-1),{button:'down',pressed:false});
domEvents.pointercancel({pointerId:28}); // system interruption, preserve other inputs
assert.deepEqual(messages.at(-1),{button:'b',pressed:false});
const afterTouch=messages.length;
buttons.get('down').events.pointerup({pointerId:27}); // duplicate captured release
assert.equal(messages.length,afterTouch,'Duplicate pointerup must not emit extra release');
buttons.get('down').events.pointerdown({pointerId:29,preventDefault(){}});
domEvents.blur(); // tab switching releases every touch
assert.deepEqual(messages.at(-1),{button:'down',pressed:false});
domEvents.keydown({type:'keydown',code:'ArrowRight',repeat:false,preventDefault(){},target:{closest:()=>null}});
assert.deepEqual(messages.at(-1),{button:'right',pressed:true});
domEvents.blur();
assert.deepEqual(messages.at(-1),{button:'right',pressed:false});
gamepad={connected:true,mapping:'standard',buttons:Array.from({length:16},()=>({pressed:false})),axes:[0,0]};
gamepad.buttons[0].pressed=true;
frame();
assert.deepEqual(messages.at(-1),{button:'a',pressed:true});
gamepad.buttons[0].pressed=false;
frame();
assert.deepEqual(messages.at(-1),{button:'a',pressed:false});
gamepad.axes[0]=-.8;
frame();
assert.deepEqual(messages.at(-1),{button:'left',pressed:true});
docEvents.visibilitychange&&Object.assign(document,{hidden:true})&&docEvents.visibilitychange();
assert.deepEqual(messages.at(-1),{button:'left',pressed:false});
controller.deactivate();
assert.equal(canceled,7);
assert([...buttons.values()].every(el=>el.disabled));
controller.destroy();
assert.equal(Object.keys(domEvents).length,0);

/* RetroArch-style large touch zones: test on coordinates, not just isolated
 * button events. Thumb sliding, diagonal switching, independent pointers and
 * slide-out release must not require a click or wait for touchend.
 */
function rect(left,top,width,height){
 return {left,top,width,height,right:left+width,bottom:top+height};
}
function zoneNode(name,bounds){
 const events={},members=[];
 return {events,members,getAttribute:key=>key==='data-sega-zone'?name:null,
  getBoundingClientRect:()=>bounds,contains:el=>members.includes(el),
  setPointerCapture(){},
  addEventListener:(type,fn)=>events[type]=fn,
  removeEventListener:(type,fn)=>{if(events[type]===fn)delete events[type]}
 };
}
const dzone=zoneNode('dpad',rect(0,0,180,180));
const fzone=zoneNode('face',rect(350,0,180,180));
const mobileButtons=[];
function mobileButton(name,bounds,zone){
 const el={disabled:true,getAttribute:key=>key==='data-sega-button'?name:null,
  getBoundingClientRect:()=>bounds,setAttribute(){},classList:{toggle(){}},
  addEventListener(){},removeEventListener(){}};
 mobileButtons.push(el);zone.members.push(el);
 return el;
}
for(const [name,left,top] of [
 ['left',0,60],['right',120,60],['up',60,0],['down',60,120]
])mobileButton(name,rect(left,top,60,60),dzone);
for(const [name,left,top] of [
 ['x',350,25],['y',410,25],['z',470,25],
 ['a',350,105],['b',410,105],['c',470,105]
])mobileButton(name,rect(left,top,58,58),fzone);
const mobileEvents={},mobileDocEvents={},mobileMessages=[];
const mobileDocument={
 querySelectorAll:selector=>selector==='[data-sega-zone]'?[dzone,fzone]:mobileButtons,
 querySelector:()=>null,hidden:false,
 addEventListener:(type,fn)=>mobileDocEvents[type]=fn,
 removeEventListener:(type,fn)=>{if(mobileDocEvents[type]===fn)delete mobileDocEvents[type]}
};
const mobileHost={document:mobileDocument,
 navigator:{getGamepads:()=>[]},
 addEventListener:(type,fn)=>mobileEvents[type]=fn,
 removeEventListener:(type,fn)=>{if(mobileEvents[type]===fn)delete mobileEvents[type]},
 requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}
};
const mobile=context.JhadinaSegaInput.create({
 host:mobileHost,onInput:msg=>mobileMessages.push({button:msg.button,pressed:msg.pressed})
});
function touch(pointerId,x,y){return {pointerId,clientX:x,clientY:y,button:0,preventDefault(){}}}
const last=(n=1)=>mobileMessages.slice(-n);
mobile.activate();
dzone.events.pointerdown(touch(11,20,90));
assert.deepEqual(last(),[{button:'left',pressed:true}],'D-pad must press on pointerdown');
dzone.events.pointermove(touch(11,30,30));
assert.deepEqual(last(),[{button:'up',pressed:true}],'Sliding into diagonal must add Up without releasing Left');
dzone.events.pointermove(touch(11,160,90));
assert.deepEqual(last(3),[
 {button:'left',pressed:false},{button:'up',pressed:false},{button:'right',pressed:true}
],'Crossing D-pad must release old inputs then press Right');
fzone.events.pointerdown(touch(12,378,130));
assert.deepEqual(last(),[{button:'a',pressed:true}],'Second thumb must press A');
fzone.events.pointermove(touch(12,438,130));
assert.deepEqual(last(2),[
 {button:'a',pressed:false},{button:'b',pressed:true}
],'Face-button slide must release A and press B without lifting');
mobileEvents.pointerup(touch(11,160,90));
assert.deepEqual(last(),[{button:'right',pressed:false}]);
assert.equal(mobileMessages.filter(m=>m.button==='b'&&m.pressed===false).length,0,
 'Releasing D-pad must preserve independently held B');
fzone.events.pointermove(touch(12,700,130));
assert.deepEqual(last(),[{button:'b',pressed:false}],'Sliding out of face area must release B');
mobileEvents.pointercancel(touch(12,700,130));
const stable=mobileMessages.length;
fzone.events.pointerup(touch(12,700,130));
assert.equal(mobileMessages.length,stable,'Duplicate pointer-up must not emit');
dzone.events.pointerdown(touch(13,160,90));
mobileDocEvents.visibilitychange&&Object.assign(mobileDocument,{hidden:true})&&
 mobileDocEvents.visibilitychange();
assert.deepEqual(last(),[{button:'right',pressed:false}],'Backgrounding must release D-pad');
mobile.destroy();
assert.equal(Object.keys(mobileEvents).length,0,'Destroy must remove global iPhone handlers');
assert.equal(Object.keys(dzone.events).length,0,'Destroy must remove D-pad handlers');
assert.equal(Object.keys(fzone.events).length,0,'Destroy must remove face handlers');
console.log('PASS: touch-zone D-pad diagonals, thumb slides, face-button rollover, simultaneous fingers, out-of-bounds release and cleanup');

console.log('PASS: Sega input gated; iPhone multi-touch down+jump, lost capture/window release, cancellation, keyboard/gamepad and blur cleanup');
