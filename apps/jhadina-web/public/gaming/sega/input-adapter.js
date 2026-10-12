/* Jhadina Genesis low-latency touch controller.
 * Inspired by the hit-zone approach in Oshanotter/RetroArch-Overlays (MIT);
 * browser-specific implementation, no third-party images or code imported.
 * The ROM bridge gates activation: this controller never self-enables.
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
 const zones=Array.from(host.document?.querySelectorAll('[data-sega-zone]')||[]);
 const buttonElements=new Map();
 for(const element of elements){
  const name=element.getAttribute?.('data-sega-button');
  if(!VALID.has(name))continue;
  if(!buttonElements.has(name))buttonElements.set(name,[]);
  buttonElements.get(name).push(element);
 }
 let active=false,raf=null;
 // Every input origin owns its own held set. Multiple pointers or keyboard
 // + gamepad never spuriously release the same held button.
 const tokens=new Map(),pointers=new Map(),listeners=[];
 const held=()=>new Set(Array.from(tokens.values()).flatMap(set=>Array.from(set)));
 function indicate(button,down){
  for(const el of buttonElements.get(button)||[]){
   el.classList?.toggle('is-pressed',down);
   el.setAttribute?.('aria-pressed',down?'true':'false');
  }
 }
 function set(source,names){
  if(!active)return;
  const next=new Set(Array.from(names||[]).filter(name=>VALID.has(name)));
  const prev=tokens.get(source)||new Set();
  if(next.size===prev.size&&[...next].every(name=>prev.has(name)))return;
  const before=held();
  if(next.size)tokens.set(source,next);else tokens.delete(source);
  const after=held();
  // Release stale directions first; new directions are asserted immediately.
  for(const name of before)if(!after.has(name)){
   indicate(name,false);onInput({button:name,pressed:false});
  }
  for(const name of after)if(!before.has(name)){
   indicate(name,true);onInput({button:name,pressed:true});
  }
 }
 function releaseAll(){
  const before=held();tokens.clear();pointers.clear();
  for(const name of before){indicate(name,false);onInput({button:name,pressed:false});}
 }
 function keyboard(event){
  if(!active)return;
  const name=KEY[event.code];if(!name)return;
  if(event.type==='keydown'){
   if(event.repeat||event.altKey||event.metaKey||event.ctrlKey)return;
   if(event.target?.closest?.('input,textarea,select,[contenteditable=true],[role=dialog]'))return;
   if(host.document?.querySelector('#libraryPanel:not([hidden])'))return;
   event.preventDefault?.();set('key:'+event.code,[name]);
  }else{
   event.preventDefault?.();set('key:'+event.code,[]);
  }
 }
 function tick(){
  if(!active)return;
  const pad=Array.from(host.navigator?.getGamepads?.()||[])
   .find(item=>item&&item.connected&&item.mapping==='standard');
  for(const name of BUTTONS){
   let pressed=false;
   if(pad){
    for(const [index,mapped] of Object.entries(PAD)){
     if(mapped===name&&pad.buttons[Number(index)]?.pressed){pressed=true;break;}
    }
    const x=Number(pad.axes?.[0]||0),y=Number(pad.axes?.[1]||0);
    if((name==='left'&&x<-.55)||(name==='right'&&x>.55)||
       (name==='up'&&y<-.55)||(name==='down'&&y>.55))pressed=true;
   }
   set('pad:'+name,pressed?[name]:[]);
  }
  raf=host.requestAnimationFrame?.(tick)??null;
 }
 function targetButton(event){
  const node=event.target?.closest?.('[data-sega-button]')||event.target;
  const value=node?.getAttribute?.('data-sega-button');
  return VALID.has(value)?value:null;
 }
 function within(zone,event,margin=14){
  const r=zone.getBoundingClientRect?.();
  if(!r||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return true;
  return event.clientX>=r.left-margin&&event.clientX<=r.right+margin&&
   event.clientY>=r.top-margin&&event.clientY<=r.bottom+margin;
 }
 function directionAt(zone,event){
  const r=zone.getBoundingClientRect?.();
  if(!r||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)){
   const fallback=targetButton(event);
   return fallback&&['up','down','left','right'].includes(fallback)?[fallback]:[];
  }
  if(!within(zone,event))return [];
  const x=(event.clientX-(r.left+r.width/2))/(r.width/2);
  const y=(event.clientY-(r.top+r.height/2))/(r.height/2);
  const result=[];
  if(x<-.24)result.push('left');else if(x>.24)result.push('right');
  if(y<-.24)result.push('up');else if(y>.24)result.push('down');
  return result; // diagonal = two real simultaneous Genesis inputs
 }
 function faceAt(zone,event){
  const validFace=['a','b','c','x','y','z','start','mode'];
  if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)){
   const fallback=targetButton(event);return fallback&&validFace.includes(fallback)?[fallback]:[];
  }
  if(!within(zone,event))return [];
  let closest=null,distance=Infinity;
  for(const button of elements){
   const name=button.getAttribute?.('data-sega-button');
   if(!validFace.includes(name)||zone.contains&&!zone.contains(button))continue;
   const r=button.getBoundingClientRect?.();if(!r)continue;
   const dx=event.clientX-(r.left+r.width/2),dy=event.clientY-(r.top+r.height/2);
   const dist=Math.hypot(dx,dy),radius=Math.max(r.width,r.height)*.82;
   if(dist<=radius&&dist<distance){closest=name;distance=dist;}
  }
  return closest?[closest]:[];
 }
 function eventButtons(kind,zone,event){
  if(kind==='dpad')return directionAt(zone,event);
  if(kind==='face'||kind==='system')return faceAt(zone,event);
  const value=targetButton(event);return value?[value]:[];
 }
 function finish(pointerId){
  if(!pointers.has(pointerId))return;
  set('pointer:'+pointerId,[]);
  pointers.delete(pointerId);
 }
 function register(node,kind){
  const down=event=>{
   if(!active||node.disabled||event.button!==undefined&&event.button!==0)return;
   const pointerId=event.pointerId;
   if(pointerId===undefined)return;
   event.preventDefault?.();finish(pointerId);
   pointers.set(pointerId,{node,kind});
   // Dispatch immediately on pointerdown rather than click/touchend.
   set('pointer:'+pointerId,eventButtons(kind,node,event));
   try{node.setPointerCapture?.(pointerId)}catch{}
  };
  const move=event=>{
   const pointer=pointers.get(event.pointerId);
   if(!pointer||pointer.node!==node)return;
   event.preventDefault?.();
   set('pointer:'+event.pointerId,eventButtons(kind,node,event));
  };
  const up=event=>{if(!pointers.has(event.pointerId))return;event.preventDefault?.();finish(event.pointerId);};
  node.addEventListener('pointerdown',down,{passive:false});
  node.addEventListener('pointermove',move,{passive:false});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])
   node.addEventListener(type,up,{passive:false});
  listeners.push([node,'pointerdown',down],[node,'pointermove',move],
   ...['pointerup','pointercancel','lostpointercapture'].map(type=>[node,type,up]));
 }
 if(zones.length){
  for(const zone of zones){
   const kind=zone.getAttribute?.('data-sega-zone');
   if(['dpad','face','system'].includes(kind))register(zone,kind);
  }
  // System keys without a zone remain direct touch targets.
  for(const element of elements){
   const name=element.getAttribute?.('data-sega-button');
   if(!['start','mode'].includes(name))continue;
   if(zones.some(zone=>zone.contains?.(element)))continue;
   register(element,'direct');
  }
 }else for(const element of elements){
  if(VALID.has(element.getAttribute?.('data-sega-button')))register(element,'direct');
 }
 const globalUp=event=>finish(event.pointerId);
 const globalMove=event=>{
  const pointer=pointers.get(event.pointerId);
  if(pointer&&active){
   // Window fallback for iOS Safari when pointer capture is interrupted.
   set('pointer:'+event.pointerId,eventButtons(pointer.kind,pointer.node,event));
  }
 };
 const blur=()=>{if(active)releaseAll();};
 const hidden=()=>{if(active&&host.document?.hidden)releaseAll();};
 for(const [type,callback] of [['keydown',keyboard],['keyup',keyboard],
  ['blur',blur],['pointerup',globalUp],['pointercancel',globalUp],
  ['pointermove',globalMove]])host.addEventListener?.(type,callback);
 host.document?.addEventListener?.('visibilitychange',hidden);
 function activate(){
  if(active)return;active=true;
  for(const el of elements)el.disabled=false;
  tick();
 }
 function deactivate(){
  if(!active)return;
  if(raf!==null)host.cancelAnimationFrame?.(raf);
  raf=null;releaseAll();active=false;
  for(const el of elements)el.disabled=true;
 }
 function destroy(){
  deactivate();
  for(const [type,callback] of [['keydown',keyboard],['keyup',keyboard],
   ['blur',blur],['pointerup',globalUp],['pointercancel',globalUp],
   ['pointermove',globalMove]])host.removeEventListener?.(type,callback);
  host.document?.removeEventListener?.('visibilitychange',hidden);
  for(const [element,type,callback] of listeners)element.removeEventListener(type,callback);
 }
 return Object.freeze({activate,deactivate,destroy,isActive:()=>active,buttons:BUTTONS});
}
root.JhadinaSegaInput=Object.freeze({create,BUTTONS,KEY});
})(globalThis);
