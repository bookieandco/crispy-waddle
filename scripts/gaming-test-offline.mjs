import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';

const dir='apps/jhadina-web/public/gaming/neon-run/';
const sw=readFileSync(dir+'sw.js','utf8');
new Script(sw,{filename:'neon-run/sw.js'});
new Script(readFileSync(dir+'offline.js','utf8'),{filename:'neon-run/offline.js'});
const manifest=JSON.parse(readFileSync(dir+'manifest.webmanifest','utf8'));
assert.equal(manifest.scope,'/gaming/neon-run/');
assert.equal(manifest.start_url,'/gaming/neon-run/index.html');
assert.equal(manifest.display,'standalone');
const scope='https://example.invalid/gaming/neon-run/';
const files=['index.html','engine.js','app.js','offline.js','manifest.webmanifest','icon.svg'];
const listeners={};
const db=new Map();
const opened=[];
let online=true,claims=0,skipped=0;
class FakeCache{
 constructor(){this.data=new Map();}
 async addAll(urls){
  const staged=[];
  for(const url of urls){
   const r=await networkFetch(url);
   if(!r.ok)throw new Error('Cannot cache failed response');
   staged.push([url,r]);
  }
  for(const [url,r] of staged)this.data.set(url,r);
 }
 async match(request){return this.data.get(typeof request==='string'?request:request.url);}
}
const caches={
 async open(name){opened.push(name);if(!db.has(name))db.set(name,new FakeCache());return db.get(name);},
 async keys(){return [...db.keys()];},
 async delete(name){return db.delete(name);},
};
async function networkFetch(req){
 if(!online)throw new Error('The device is offline');
 const url=typeof req==='string'?req:req.url;
 return{ok:true,url,source:'network'};
}
const self={
 registration:{scope},location:{origin:'https://example.invalid'},
 addEventListener:(name,handler)=>{listeners[name]=handler;},
 skipWaiting:async()=>{skipped++;},
 clients:{claim:async()=>{claims++;}},
};
runInNewContext(sw,{self,caches,fetch:networkFetch,URL,console},{filename:'neon-run/sw.js'});
assert.deepEqual(Object.keys(listeners).sort(),['activate','fetch','install']);
async function lifecycle(kind){
 let promise;
 listeners[kind]({waitUntil:p=>{promise=p;}});
 assert(promise,'missing waitUntil for '+kind);
 return promise;
}
await lifecycle('install');
assert.equal(skipped,1);
const cache=await caches.open('jhadina-neon-run-shell-v1-20261010');
assert.deepEqual([...cache.data.keys()].sort(),files.map(f=>scope+f).sort(),'only public shell is cached');
db.set('jhadina-neon-run-shell-v0',new FakeCache());
db.set('other-jhadina-application',new FakeCache());
await lifecycle('activate');
assert.equal(claims,1);
assert.equal(db.has('jhadina-neon-run-shell-v0'),false);
assert.equal(db.has('other-jhadina-application'),true,'never delete other applications caches');
async function dispatch(url,method='GET'){
 let handled;
 listeners.fetch({
  request:{url,method,mode:url.endsWith('index.html')?'navigate':'same-origin'},
  respondWith(p){handled=p;},
 });
 return handled;
}
online=false;
for(const name of files){
 const result=await (await dispatch(scope+name));
 assert.equal(result?.url,scope+name,'offline cached file '+name);
}
for(const url of [
 'https://example.invalid/gaming/gameboy/index.html',
 'https://example.invalid/gaming/neon-run/user-save.json',
 'https://drive.google.com/drive/folders/example',
 scope+'index.html?token=private',
]){
 assert.equal(await dispatch(url),undefined,'SW must not intercept '+url);
}
assert.equal(await dispatch(scope+'index.html','POST'),undefined);
cache.data.delete(scope+'engine.js');
await assert.rejects(()=>dispatch(scope+'engine.js').then(p=>p),/offline/);
console.log('PASS: Neon Run offline shell precache, offline-only reload, narrow scope, foreign cache isolation, fail-closed misses');
