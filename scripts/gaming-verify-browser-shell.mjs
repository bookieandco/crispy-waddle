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
const frame=readFileSync(resolve(root,'player.html'),'utf8');
if(!frame.includes("crypto.subtle.digest")||!frame.includes('/vendor/emulatorjs/approved/manifest.json'))
  throw new Error('Player missing local cryptographic emulator loader admission');
if(!frame.includes("connect-src 'self'"))throw new Error('Player missing same-origin network gate');
const index=readFileSync(resolve(root,'index.html'),'utf8');
if(!index.includes('/gaming/gameboy/backup.js'))throw new Error('Encrypted save backup entrypoint is missing');
if(!index.includes('sandbox="allow-scripts allow-same-origin allow-pointer-lock"')||
   !index.includes("event.origin!==location.origin"))throw new Error('Player-parent origin checks incomplete');
const approved=resolve('apps/jhadina-web/public/vendor/emulatorjs/approved/manifest.json');
if(existsSync(approved)){
  const manifest=JSON.parse(readFileSync(approved,'utf8'));
  if(manifest.schema!=='jhadina.gaming.emulatorjs.approved.v1')throw new Error('Unsupported EmulatorJS manifest schema');
}
console.log('PASS: Game Boy HTML scripts parse and local loader/origin safeguards are present');
console.log('Physical gameplay and emulator assets are NOT certified by this check');
