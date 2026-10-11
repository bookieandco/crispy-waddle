import {readFileSync, existsSync} from 'node:fs';
import {Script} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve('apps/jhadina-web/public/gaming/gameboy');
const documents=['index.html','player.html'];
for(const name of documents){
  const html=readFileSync(resolve(root,name),'utf8');
  const inline=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(m=>!/(?:^|\s)src\s*=/.test(m[1])).map(m=>m[2]);
  if(inline.length!==1)throw new Error(`${name}: expected exactly one local controller script`);
  new Script(inline[0],{filename:name});
  if(/<script\s+[^>]*src=["']https?:/i.test(html))throw new Error(`${name}: external script source forbidden`);
  if(!html.includes('viewport')||!html.includes('game'))throw new Error(`${name}: missing browser shell markers`);
}
new Script(readFileSync(resolve(root,'backup.js'),'utf8'),{filename:'backup.js'});
new Script(readFileSync(resolve(root,'storage.js'),'utf8'),{filename:'storage.js'});
const frame=readFileSync(resolve(root,'player.html'),'utf8');
if(!frame.includes('/vendor/binjgb/approved/binjgb.js')
   ||!frame.includes('/vendor/binjgb/approved/jhadina-simple.js')
   ||!frame.includes('window.JhadinaGbSaveData')||!frame.includes('msg.gameId'))
 throw new Error('Browser Game Boy runtime is missing local WASM admission or save bridging');
if(!frame.includes("connect-src 'self'"))throw new Error('Player missing same-origin network gate');
const index=readFileSync(resolve(root,'index.html'),'utf8');
if(!index.includes('/gaming/gameboy/backup.js')||!index.includes('/gaming/gameboy/storage.js'))throw new Error('Encrypted save or atomic storage entrypoint missing');
if(!index.includes('sandbox="allow-scripts allow-same-origin allow-pointer-lock"')||
   !index.includes("event.origin!==location.origin"))throw new Error('Player-parent origin checks incomplete');
const binjgb=resolve('apps/jhadina-web/public/vendor/binjgb/approved');
const binjgbSource=readFileSync(resolve(binjgb,'jhadina-simple.js'),'utf8');
new Script(binjgbSource,{filename:'jhadina-simple.js'});
if(binjgbSource.includes('localStorage')||binjgbSource.includes('porklike.gb'))
 throw new Error('Emulator must not mingle cross-game save storage or use a public ROM');
const approved=resolve('apps/jhadina-web/public/vendor/emulatorjs/approved/manifest.json');
if(existsSync(approved)){
  const manifest=JSON.parse(readFileSync(approved,'utf8'));
  if(manifest.schema!=='jhadina.gaming.emulatorjs.approved.v1')throw new Error('Unsupported EmulatorJS manifest schema');
}
const arcadeRoot=resolve('apps/jhadina-web/public/gaming/neon-run');
for(const path of ['engine.js','app.js'])new Script(readFileSync(resolve(arcadeRoot,path),'utf8'),{filename:path});
const offlineSw=readFileSync(resolve(arcadeRoot,'sw.js'),'utf8');
const offlineClient=readFileSync(resolve(arcadeRoot,'offline.js'),'utf8');
new Script(offlineSw,{filename:'neon-run/sw.js'});
new Script(offlineClient,{filename:'neon-run/offline.js'});
const manifest=JSON.parse(readFileSync(resolve(arcadeRoot,'manifest.webmanifest'),'utf8'));
if(manifest.scope!=='/gaming/neon-run/'||manifest.start_url!=='/gaming/neon-run/index.html')
 throw new Error('Neon Run offline PWA must remain strictly game scoped');
if(!offlineSw.includes('ALLOW.has(url.href)')||!offlineSw.includes('if(request.method!==\'GET\')'))
 throw new Error('Neon Run service worker must block unrelated or private requests');
const arcade=readFileSync(resolve(arcadeRoot,'index.html'),'utf8');
if(!arcade.includes('viewport')||!arcade.includes('touch-action:none')||!arcade.includes('./engine.js')||!arcade.includes('./app.js')||!arcade.includes('./offline.js')||!arcade.includes('worker-src \'self\''))throw new Error('Original arcade is missing phone input and local script assets');
if(/<script\s+[^>]*src=["']https?:/i.test(arcade))throw new Error('Original arcade cannot load external code');
const diagnosticsRoot=resolve('apps/jhadina-web/public/gaming/diagnostics');
const deviceCheck=readFileSync(resolve(diagnosticsRoot,'diagnostics.js'),'utf8');
new Script(deviceCheck,{filename:'diagnostics.js'});
const deviceHtml=readFileSync(resolve(diagnosticsRoot,'index.html'),'utf8');
for(const id of ['testStorage','testCrypto','touchTarget','testGamepad','download']){
 if(!deviceHtml.includes('id="'+id+'"'))throw new Error('Missing manual hardware test control: '+id);
}
if(/<script\s+[^>]*src=["']https?:/i.test(deviceHtml))throw new Error('Diagnostics must not source third-party code');
if(!deviceCheck.includes('event.isTrusted')||!deviceCheck.includes('no-personal-data'))throw new Error('Hardware evidence requires genuine local interaction and private receipt');
console.log('PASS: Game Boy HTML scripts parse and local loader/origin safeguards are present');
console.log('Physical gameplay and emulator assets are NOT certified by this check');
