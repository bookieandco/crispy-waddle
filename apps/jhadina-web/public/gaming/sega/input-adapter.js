/* Sega 3/6-button input adapter.
 * This adapter has no emulator dependency and NEVER self-enables.
 * A reviewed runtime must explicitly call activate() with a real callback.
 */
(function(root){
'use strict';
const BUTTONS=Object.freeze(['up','down','left','right','a','b','c','x','y','z','start','mode']);
const KEY=Object.freeze({
 ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',
 KeyZ:'a',KeyX:'b',KeyC:'c',KeyA:'x',KeyS:'y',KeyD:'z',Enter:'start',ShiftLeft:'mode'
});
const PAD=Object.freeze({0:'a',1:'b',2:'c',3:'x',4:'y',5:'z',8:'mode',9:'start',12:'up',13:'down',14:'left',15:'right'});
const VALID=new Set(BUTTONS);
function create({onInput,buttons,host=root}){
 if(typeof onInput!=='function')throw new TypeError('Input sink is required');
 const elements=Array.from(buttons||host.document?.querySelectorAll('[data-sega-button]')||[]);
 let active=false,raf=null;
 const tokens=new Map(),pointers=new Map(),listeners=[];
 function isHeld(button){return Array.from(tokens.values()).includes(button)}
 function set(source,button,down){
  if(!VALID.has(button)||!active)return;
  const was=isHeld(button),old=tokens.get(source);
  if(down){
   if(old===button)return;
   if(old)tokens.delete(source);
   tokens.set(source,button);
  }else if(old===button){tokens.delete(source)}else return;
  const now=isHeld(button);
  if(old&&old!==button&&!isHeld(old))onInput({button:old,pressed:false});
  if(was!==now)onInput({button,pressed:now});
 }
 function releaseAll(){
  const held=new Set(tokens.values());tokens.clear();pointers.clear();
  for(const button of held)onInput({button,pressed:false});
 }
 function keyboard(event){
  if(!active)return;
  const button=KEY[event.code];if(!button)return;
  if(event.type==='keydown'){
   if(event.repeat||event.altKey||event.metaKey||event.ctrlKey)return;
   const target=event.target;
   if(target?.closest?.('input,textarea,select,[contenteditable=true],[role=dialog]'))return;
   if(host.document?.querySelector('#libraryPanel:not([hidden])'))return;
   event.preventDefault?.();set('key:'+event.code,button,true);
  }else{event.preventDefault?.();set('key:'+event.code,button,false)}
 }
 function tick(){
  if(!active)return;
  const gamepads=host.navigator?.getGamepads?.()||[];
  const pad=Array.from(gamepads).find(x=>x&&x.connected&&x.mapping==='standard');
  for(const button of BUTTONS){
   let pressed=false;
   if(pad){
    for(const [index,mapped] of Object.entries(PAD)){
     if(mapped===button&&pad.buttons[Number(index)]?.pressed){pressed=true;break}
    }
    const x=Number(pad.axes?.[0]||0),y=Number(pad.axes?.[1]||0);
    if(button==='left'&&x<-.55||button==='right'&&x>.55||
       button==='up'&&y<-.55||button==='down'&&y>.55)pressed=true;
   }
   set('pad:'+button,button,pressed);
  }
  raf=host.requestAnimationFrame?.(tick)??null;
 }
 const pointerCallbacks=[];
 for(const element of elements){
  const button=element.getAttribute?.('data-sega-button');
  if(!VALID.has(button))continue;
  const down=event=>{
   if(!active||element.disabled)return;
   event.preventDefault?.();
   const source='pointer:'+event.pointerId;
   if(pointers.has(event.pointerId))set(source,pointers.get(event.pointerId),false);
   pointers.set(event.pointerId,button);
   element.setPointerCapture?.(event.pointerId);
   set(source,button,true);
  };
  const up=event=>{
   const current=pointers.get(event.pointerId);if(!current)return;
   set('pointer:'+event.pointerId,current,false);
   pointers.delete(event.pointerId);
  };
  element.addEventListener('pointerdown',down,{passive:false});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,up);
  pointerCallbacks.push({element,down,up});
 }
 const blur=()=>{if(active)releaseAll()};
 const hidden=()=>{if(host.document?.hidden&&active)releaseAll()};
 host.addEventListener?.('keydown',keyboard);
 host.addEventListener?.('keyup',keyboard);
 host.addEventListener?.('blur',blur);
 host.document?.addEventListener?.('visibilitychange',hidden);
 function activate(){
  if(active)return;
  active=true;
  for(const el of elements)el.disabled=false;
  tick();
 }
 function deactivate(){
  if(!active)return;
  if(raf!==null)host.cancelAnimationFrame?.(raf);
  raf=null;
  releaseAll();active=false;
  for(const el of elements)el.disabled=true;
 }
 function destroy(){
  deactivate();
  host.removeEventListener?.('keydown',keyboard);
  host.removeEventListener?.('keyup',keyboard);
  host.removeEventListener?.('blur',blur);
  host.document?.removeEventListener?.('visibilitychange',hidden);
  for(const {element,down,up} of pointerCallbacks){
   element.removeEventListener('pointerdown',down);
   for(const type of ['pointerup','pointercancel','lostpointercapture'])element.removeEventListener(type,up);
  }
 }
 return Object.freeze({activate,deactivate,destroy,isActive:()=>active,buttons:BUTTONS});
}
root.JhadinaSegaInput=Object.freeze({create,BUTTONS,KEY});
})(globalThis);
