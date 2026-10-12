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
console.log('PASS: Sega input gated; iPhone multi-touch down+jump, lost capture/window release, cancellation, keyboard/gamepad and blur cleanup');
