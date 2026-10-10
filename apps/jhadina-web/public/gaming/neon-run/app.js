/* Neon Run phone controls, input polling, canvas renderer and IndexedDB high score. */
(function(){
'use strict';
const E=window.JhadinaNeonRun;
if(!E)throw Error('Neon Run engine missing');
const $=id=>document.getElementById(id);
const canvas=$('playfield'),ctx=canvas.getContext('2d',{alpha:false});
if(!ctx){$('status').textContent='Canvas is unavailable in this browser';return;}
const W=E.W,H=E.H,recordKey='arcade:neon-run:best';
let s=E.create((Math.random()*0xffffffff)>>>0),best=0,previous=0,touch=null,gamepadAction=false;
const held=new Set();
const sky=Array.from({length:130},(_,i)=>({x:(i*97.9+13)%W,y:(i*43.7+41)%H,r:0.6+i%3*.6}));
function status(x){$('status').textContent=x;}
function hud(){
 $('score').textContent=Math.floor(s.score).toLocaleString();
 $('best').textContent=Math.max(best,Math.floor(s.score)).toLocaleString();
 $('lives').textContent=s.lives+' ♥';$('combo').textContent='×'+Math.max(1,s.combo);
 const playing=s.status==='playing';
 $('overlay').hidden=playing;
 $('toggle').textContent=playing?'Pause':s.status==='paused'?'Resume':s.status==='over'?'Play again':'Play';
 $('overlayTitle').textContent=s.status==='paused'?'Paused':s.status==='over'?'Game over':'Neon Run';
 $('overlayCopy').textContent=s.status==='over'?'Final score '+Math.floor(s.score)+' — ready for another run?':s.status==='paused'?'Resume to continue':'Collect stars, dodge meteors, grab shields';
 $('overlayPlay').textContent=s.status==='over'?'Play again':s.status==='paused'?'Resume':'Start';
}
function db(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open('jhadina-game-core-v1',1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('records'))req.result.createObjectStore('records',{keyPath:'key'});};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error('Local database failed'));
  req.onblocked=()=>reject(new Error('Please close other gaming tabs'));
 });
}
async function readBest(){
 const dbh=await db();
 try{return await new Promise((resolve,reject)=>{
  const r=dbh.transaction('records','readonly').objectStore('records').get(recordKey);
  r.onsuccess=()=>resolve(Number.isFinite(r.result?.payload?.score)?Math.max(0,r.result.payload.score):0);
  r.onerror=()=>reject(r.error);
 });}finally{dbh.close();}
}
async function saveBest(score){
 const dbh=await db();
 try{return await new Promise((resolve,reject)=>{
  const tx=dbh.transaction('records','readwrite'),store=tx.objectStore('records');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Save blocked'));
  const req=store.get(recordKey);
  req.onsuccess=()=>{
   const previous=req.result;
   if((previous?.payload?.score||0)>=score)return;
   store.put({key:recordKey,revision:(previous?.revision||0)+1,payload:{gameId:'neon-run',score:Math.floor(score),achievedAtMs:Date.now()}});
  };
 });}finally{dbh.close();}
}
function launch(){
 if(s.status==='over')s=E.create((Math.random()*0xffffffff)>>>0);
 E.start(s);previous=0;hud();status('Playing · swipe or drag to steer, use a gamepad or WASD / arrows');
}
function pause(){E.pause(s);touch=null;hud();status('Paused')}
function toggle(){s.status==='playing'?pause():launch();}
$('toggle').addEventListener('click',toggle);
$('overlayPlay').addEventListener('click',launch);
$('reset').addEventListener('click',()=>{s=E.create((Math.random()*0xffffffff)>>>0);launch();});
$('help').addEventListener('click',()=>{$('instructions').hidden=!$('instructions').hidden;});
document.addEventListener('keydown',e=>{
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code)&&e.target?.tagName!=='BUTTON')e.preventDefault();
 held.add(e.code);
 if(e.code==='Space'&&!e.repeat&&e.target?.tagName!=='BUTTON')toggle();
 if(e.code==='Escape')pause();
});
document.addEventListener('keyup',e=>held.delete(e.code));
function suspend(){held.clear();touch=null;pause();}
addEventListener('blur',suspend);
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
function toWorld(e){
 const b=canvas.getBoundingClientRect();
 return{x:(e.clientX-b.left)/b.width*W,y:(e.clientY-b.top)/b.height*H};
}
canvas.addEventListener('pointerdown',e=>{if(s.status!=='playing')return;touch=toWorld(e);canvas.setPointerCapture?.(e.pointerId);e.preventDefault();});
canvas.addEventListener('pointermove',e=>{if(touch){touch=toWorld(e);e.preventDefault();}});
for(const kind of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(kind,()=>{touch=null;});
function inputs(){
 let x=Number(held.has('ArrowRight')||held.has('KeyD'))-Number(held.has('ArrowLeft')||held.has('KeyA'));
 let y=Number(held.has('ArrowDown')||held.has('KeyS'))-Number(held.has('ArrowUp')||held.has('KeyW'));
 const gamepads=typeof navigator.getGamepads==='function'?Array.from(navigator.getGamepads()).filter(Boolean):[];
 const pad=gamepads[0];
 if(pad){
  const horizontal=Number(pad.axes?.[0]||0),vertical=Number(pad.axes?.[1]||0);
  if(Math.abs(horizontal)>.17)x+=horizontal;
  if(Math.abs(vertical)>.17)y+=vertical;
  x+=Number(!!pad.buttons?.[15]?.pressed)-Number(!!pad.buttons?.[14]?.pressed);
  y+=Number(!!pad.buttons?.[13]?.pressed)-Number(!!pad.buttons?.[12]?.pressed);
  const action=Boolean(pad.buttons?.[0]?.pressed||pad.buttons?.[9]?.pressed);
  if(action&&!gamepadAction)toggle();
  gamepadAction=action;
 }else gamepadAction=false;
 return {x,y,...(touch?{targetX:touch.x,targetY:touch.y}:{})};
}
function draw(){
 const background=ctx.createLinearGradient(0,0,W,H);
 background.addColorStop(0,'#08132b');background.addColorStop(.5,'#121a38');background.addColorStop(1,'#120d25');
 ctx.fillStyle=background;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='rgba(112,224,255,.11)';ctx.lineWidth=1;
 for(let x=-H;x<W+H;x+=60){
  const offset=s.time*17%60;
  ctx.beginPath();ctx.moveTo(x+offset,0);ctx.lineTo(x+H+offset,H);ctx.stroke();
 }
 for(const a of sky){ctx.fillStyle='rgba(205,240,255,.7)';ctx.beginPath();ctx.arc(a.x,(a.y+s.time*(8+a.r*8))%H,a.r,0,Math.PI*2);ctx.fill();}
 for(const o of s.objects){
  ctx.save();ctx.translate(o.x,o.y);ctx.shadowBlur=18;
  if(o.kind==='meteor'){
   ctx.shadowColor='#fc6a7d';ctx.fillStyle='#ec6079';ctx.strokeStyle='#ffb1bd';ctx.lineWidth=2;
   ctx.rotate(o.spin*.6);ctx.beginPath();
   for(let i=0;i<9;i++){
    const angle=i*2*Math.PI/9,r=o.r*(i%2?.76:1);
    if(i===0)ctx.moveTo(Math.cos(angle)*r,Math.sin(angle)*r);else ctx.lineTo(Math.cos(angle)*r,Math.sin(angle)*r);
   }
   ctx.closePath();ctx.fill();ctx.stroke();
  }else if(o.kind==='star'){
   ctx.shadowColor='#f5cf4f';ctx.fillStyle='#ffdc66';ctx.beginPath();
   for(let i=0;i<10;i++){
    const r=i%2?7:18,angle=-Math.PI/2+i*Math.PI/5;
    if(!i)ctx.moveTo(Math.cos(angle)*r,Math.sin(angle)*r);else ctx.lineTo(Math.cos(angle)*r,Math.sin(angle)*r);
   }
   ctx.closePath();ctx.fill();
  }else{
   ctx.shadowColor='#62e9f7';ctx.fillStyle='#65f1e5';ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle='#0e2845';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(7,0);ctx.moveTo(0,-7);ctx.lineTo(0,7);ctx.stroke();
  }
  ctx.restore();
 }
 const p=s.ship;
 if(!(p.immune>0&&Math.floor(p.immune*13)%2===0)){
  ctx.save();ctx.translate(p.x,p.y);ctx.shadowColor='#50ebff';ctx.shadowBlur=26;ctx.fillStyle='#6beeff';
  ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(-21,21);ctx.lineTo(0,13);ctx.lineTo(21,21);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle='#fffbd3';ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(-7,3);ctx.lineTo(7,3);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ffa768';ctx.beginPath();ctx.moveTo(-9,23);ctx.lineTo(0,38+Math.sin(s.time*22)*4);ctx.lineTo(9,23);ctx.fill();ctx.restore();
 }
 if(p.shield){ctx.strokeStyle='#69eeed';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,35,0,Math.PI*2);ctx.stroke();}
}
function frame(t){
 const delta=previous?Math.min(.05,(t-previous)/1000):0;previous=t;
 const move=inputs();
 if(s.status==='playing'){
  E.step(s,delta,move);
  if(s.status==='over'){
   const points=Math.floor(s.score);best=Math.max(best,points);
   saveBest(points).catch(()=>status('High score could not be saved; check browser storage.'));
   status('Game over. Your high score stays local and can be backed up.');
  }else if(s.events.includes('shield'))status('Shield acquired');
  else if(s.events.includes('hit'))status('Ouch! '+s.lives+' lives left');
 }
 draw();hud();requestAnimationFrame(frame);
}
readBest().then(v=>{best=v;hud()}).catch(()=>status('IndexedDB unavailable. You can play, but high scores may not persist.'));
hud();requestAnimationFrame(frame);
})();
