import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext, Script} from 'node:vm';
import {deflateRawSync} from 'node:zlib';
import {webcrypto} from 'node:crypto';

const modulePath='apps/jhadina-web/public/gaming/sega/rom-import.js';
const source=readFileSync(modulePath,'utf8');
new Script(source,{filename:modulePath});
const sandbox={Uint8Array,Uint32Array,TextDecoder,Blob,DecompressionStream,crypto:webcrypto};
runInNewContext(source,sandbox);
const api=sandbox.JhadinaSegaCartridge;
assert.equal(typeof api.importCartridge,'function');
const fixture=Buffer.alloc(524288);
fixture.write('SEGA MEGA DRIVE ',0x100,'ascii');
fixture.write('JHADINA SYNTHETIC TEST CART',0x150,'ascii');
fixture.write('U',0x1f0,'ascii');
assert.equal(api.inspect(fixture).platform,'genesis');
assert.match(api.inspect(fixture).title,/JHADINA SYNTHETIC/);
assert.throws(()=>api.inspect(Buffer.alloc(524288)),/header missing/i);
assert.throws(()=>api.inspect(Buffer.alloc(513)),/even/);

const file=(name,bytes)=>({name,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
const plain=await api.importCartridge(file('demo.md',fixture));
assert.equal(plain.size,524288);
assert.equal(plain.sha256.length,64);
assert.equal(plain.bytes.length,fixture.length);
await assert.rejects(()=>api.importCartridge(file('old.smd',fixture)),/Interleaved/);
function makeZip(entries){
 const chunks=[],dirs=[];let position=0;
 for(const entry of entries){
  const name=Buffer.from(entry.name,'utf8'),input=entry.bytes||fixture;
  const method=entry.method??8,compressed=method===8?deflateRawSync(input):input;
  const crc=entry.crc??api.crc32(input);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);
  local.writeUInt16LE(20,4);local.writeUInt16LE(entry.flags||0,6);
  local.writeUInt16LE(method,8);local.writeUInt32LE(crc>>>0,14);
  local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(input.length,22);local.writeUInt16LE(name.length,26);
  chunks.push(local,name,compressed);
  const dir=Buffer.alloc(46);dir.writeUInt32LE(0x02014b50,0);dir.writeUInt16LE(20,4);
  dir.writeUInt16LE(20,6);dir.writeUInt16LE(entry.flags||0,8);
  dir.writeUInt16LE(method,10);dir.writeUInt32LE(crc>>>0,16);
  dir.writeUInt32LE(compressed.length,20);dir.writeUInt32LE(input.length,24);
  dir.writeUInt16LE(name.length,28);dir.writeUInt32LE(position,42);
  dirs.push(dir,name);position+=local.length+name.length+compressed.length;
 }
 const directory=Buffer.concat(dirs),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
 end.writeUInt32LE(directory.length,12);end.writeUInt32LE(position,16);
 return Buffer.concat([...chunks,directory,end]);
}
const stored=await api.importCartridge(file('stored.zip',makeZip([{name:'game.md',method:0}])));
assert.equal(stored.sha256,plain.sha256);
const deflated=await api.importCartridge(file('compressed.zip',makeZip([{name:'game.md'}])));
assert.equal(deflated.sha256,plain.sha256);
for(const [label,data,regex] of [
 ['No Sega file',makeZip([{name:'README.txt',bytes:Buffer.from('hi'),method:0}]),/no supported/i],
 ['Two Sega files',makeZip([{name:'first.md'},{name:'second.gen'}]),/multiple Sega/i],
 ['Traversal path',makeZip([{name:'../evil.md'}]),/Unsafe cartridge/i],
 ['Encrypted',makeZip([{name:'hidden.md',flags:1}]),/Encrypted ZIP/i],
 ['CRC mismatch',makeZip([{name:'cart.md',crc:0}]),/CRC check failed/i],
 ['Wrong ROM header',makeZip([{name:'blank.md',bytes:Buffer.alloc(1024)}]),/header missing/i],
 ['Missing directory',Buffer.from('no zip'),/ZIP must be between/i]
]){
 await assert.rejects(()=>api.importCartridge(file('test.zip',data)),regex,label);
}
const html=readFileSync('apps/jhadina-web/public/gaming/sega/index.html','utf8');
const app=readFileSync('apps/jhadina-web/public/gaming/sega/app.js','utf8');
new Script(app,{filename:'sega/app.js'});
assert(html.includes('/gaming/sega/rom-import.js')&&html.includes('/gaming/sega/app.js'));
assert(html.includes('/gaming/sega/device-check.js'));
assert(html.includes('/gaming/sega/input-adapter.js'));
new Script(readFileSync('apps/jhadina-web/public/gaming/sega/input-adapter.js','utf8'),{filename:'input-adapter.js'});
assert(!/<script[^>]+src=["']https?:/i.test(html));
assert(html.includes('id="segaScreen"')&&html.includes('width="320" height="224"'));
assert(html.includes('id="rotateNotice"')&&html.includes('id="portraitLibrary"'));
assert(html.includes('id="libraryPanel"')&&html.includes('id="closeLibrary"'));
assert(html.includes('@media (orientation:portrait)')&&html.includes('orientation:landscape'));
assert(html.includes('touch-action:none')&&html.includes('safe-area-inset-left'));
// Large-screen mode must preserve the live 4:3 renderer and separate
// thumb-sized controls; toggling may not navigate or restart the ROM.
assert(html.includes('id="toggleScreen"')&&html.includes('aria-pressed="true"'),
 'Landscape display-size toggle must be reachable and accessible');
assert(html.includes('#app.big-screen')&&html.includes('.big-screen .bevel'),
 'Immersive console should maximize the real WASM display');
assert(html.includes('.big-screen .systemButtons')&&html.includes('.big-screen .console'),
 'Keep Start/Mode and both controls reachable outside the picture');
assert(html.includes('max-height:calc(100dvh - 12px)'),
 'Large-screen picture must be bounded by the physical viewport');
assert(app.includes("layout.classList.toggle('big-screen',bigScreen)")&&
 app.includes("screenToggle.setAttribute('aria-pressed',String(bigScreen))"),
 'Toggle must change layout and accessible state without replacing a live canvas');
assert(app.includes("localStorage.setItem(LAYOUT_KEY,String(bigScreen))"),
 'Selected view preference must survive reloads on the same host');
assert(!app.includes('location.reload()'),'Screen resizing must never reload a running game');
for(const name of ['up','down','left','right','start','mode','a','b','c','x','y','z']){
 const token=new RegExp('data-sega-button="'+name+'"[^>]*disabled');
 assert(token.test(html),'Controls must stay runtime gated: '+name);
}
assert(!/fetch\s*\(/.test(app+source));
assert(app.includes('genrom:')&&app.includes('library:')&&app.includes("transaction(STORE,'readwrite')"));
assert(app.includes("event.key==='Escape'")&&app.includes("previousFocus"));
const deviceSource=readFileSync('apps/jhadina-web/public/gaming/sega/device-check.js','utf8');
new Script(deviceSource,{filename:'device-check.js'});
const deviceHost={
 navigator:{maxTouchPoints:5,gpu:{requestAdapter:async()=>({})},getGamepads:()=>[]},
 isSecureContext:true,crossOriginIsolated:true,WebAssembly
};
runInNewContext(deviceSource,deviceHost);
const capability=await deviceHost.JhadinaSegaDevice.inspect();
assert.equal(capability.webGPUAdapter,true);
assert.equal(capability.crossOriginIsolated,true);
assert.equal(capability.readyToPlay,false);
assert.equal(capability.emulatorInstalled,false);
assert.equal(capability.ownerTestStaged,false);
assert.match(deviceHost.JhadinaSegaDevice.summary(capability),/Private engine test staged: no/);
assert.match(deviceHost.JhadinaSegaDevice.summary(capability),/Play certification: pending/);
deviceHost.JhadinaSegaLocalTest={isInstalled:async()=>true};
const staged=await deviceHost.JhadinaSegaDevice.inspect();
assert.equal(staged.ownerTestStaged,true);
assert.equal(staged.emulatorInstalled,false,'Never treat test package as approved');
assert.equal(staged.readyToPlay,false,'Capability probe never claims a playable game');
assert.match(deviceHost.JhadinaSegaDevice.summary(staged),/Private engine test staged: yes/);
assert.match(deviceHost.JhadinaSegaDevice.summary(staged),/Approved Sega engine installed: no/);
const limitedHost={navigator:{},isSecureContext:false,crossOriginIsolated:false};
runInNewContext(deviceSource,limitedHost);
assert.equal((await limitedHost.JhadinaSegaDevice.inspect()).webGPUAdapter,false);
const config=readFileSync('apps/jhadina-web/next.config.js','utf8');
assert(config.includes('source: "/gaming/sega/:path*"'));
assert(config.includes('"Cross-Origin-Opener-Policy"')&&config.includes('"Cross-Origin-Embedder-Policy"'));
const middleware=readFileSync('apps/jhadina-web/src/lib/supabase/middleware.ts','utf8');
for(const p of ['/gaming/sega/index.html','/gaming/sega/rom-import.js','/gaming/sega/app.js','/gaming/sega/device-check.js','/gaming/sega/input-adapter.js'])assert(middleware.includes('"'+p+'"'));
console.log('PASS: synthetic Genesis ROM inspection, ZIP integrity, landscape Sega shell, device preflight and route isolation');
console.log('No proprietary ROM, Sega runtime, iPhone gameplay or save-state is certified by this test');
