/* Original Jhadina Neon Run arcade logic. No ROMs, external assets or dependencies. */
(function(root){
'use strict';
const W=960,H=540,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function create(seed=123456789){
 return{seed:(seed>>>0)||1,status:'ready',time:0,score:0,lives:3,combo:0,
 ship:{x:W/2,y:H-88,r:20,shield:0,immune:0},objects:[],spawnClock:0,events:[]};
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function start(s){if(s.status==='ready'||s.status==='paused')s.status='playing';return s;}
function pause(s){if(s.status==='playing')s.status='paused';return s;}
function add(s,kind,x,y,vy){
 if(!['meteor','star','shield'].includes(kind))throw Error('Unrecognized arcade object');
 s.objects.push({kind,x,y,vy,r:kind==='meteor'?24:kind==='star'?17:20,spin:0});
}
function spawn(s){
 const v=random(s),kind=v<.71?'meteor':v<.95?'star':'shield';
 add(s,kind,30+random(s)*(W-60),-30,(kind==='meteor'?195:150)+(random(s)*85)+Math.min(180,s.time*2));
}
function step(s,dt,input={}){
 s.events=[];
 if(s.status!=='playing')return s;
 if(!Number.isFinite(dt)||dt<0)throw Error('Invalid game timestep');
 dt=Math.min(.05,dt);
 s.time+=dt;s.score+=dt*5;
 const ship=s.ship;
 ship.immune=Math.max(0,ship.immune-dt);
 let dx=Number.isFinite(input.x)?clamp(input.x,-1,1):0;
 let dy=Number.isFinite(input.y)?clamp(input.y,-1,1):0;
 const n=Math.hypot(dx,dy)||1;dx/=Math.max(1,n);dy/=Math.max(1,n);
 ship.x+=dx*400*dt;ship.y+=dy*400*dt;
 if(Number.isFinite(input.targetX)&&Number.isFinite(input.targetY)){
  const targetX=clamp(input.targetX,30,W-30),targetY=clamp(input.targetY,45,H-33);
  ship.x+=(targetX-ship.x)*Math.min(1,dt*17);
  ship.y+=(targetY-ship.y)*Math.min(1,dt*17);
 }
 ship.x=clamp(ship.x,25,W-25);ship.y=clamp(ship.y,36,H-30);
 s.spawnClock+=dt;
 const interval=Math.max(.26,.86-s.time*.004);
 while(s.spawnClock>=interval){s.spawnClock-=interval;spawn(s);}
 for(let i=s.objects.length-1;i>=0;i--){
  const obj=s.objects[i];
  obj.y+=obj.vy*dt;obj.spin+=dt;
  if(obj.y>H+obj.r){s.objects.splice(i,1);continue;}
  if(Math.hypot(obj.x-ship.x,obj.y-ship.y)>=ship.r+obj.r-4)continue;
  if(obj.kind==='star'){
   s.combo++;s.score+=30+Math.min(s.combo,12)*5;s.events.push('collected');
  }else if(obj.kind==='shield'){
   ship.shield=Math.min(2,ship.shield+1);s.events.push('shield');
  }else if(ship.immune===0){
   if(ship.shield){ship.shield--;s.events.push('shield-block');}
   else{s.lives--;s.combo=0;s.events.push('hit');if(s.lives<=0){s.status='over';s.events.push('game-over');}}
   ship.immune=1.0;
  }
  s.objects.splice(i,1);
  if(s.status==='over')break;
 }
 return s;
}
root.JhadinaNeonRun=Object.freeze({W,H,create,start,pause,add,step,clamp});
})(typeof window==='object'?window:globalThis);
