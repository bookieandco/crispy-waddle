import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext, Script} from 'node:vm';
import {deflateRawSync} from 'node:zlib';
const source=readFileSync('apps/jhadina-web/public/gaming/gameboy/zip-import.js','utf8');
new Script(source,{filename:'zip-import.js'});
const sandbox={Uint8Array,Uint32Array,Blob,TextDecoder,DecompressionStream};
runInNewContext(source,sandbox);
const unzip=sandbox.JhadinaGameBoyZip.extractSingleGameBoyRom;
assert.equal(typeof unzip,'function');
const rom=readFileSync('apps/jhadina-web/public/gaming/gameboy/homebrew/2048.gb');
function crc32(a) {
 let c=0xffffffff;
 for(const byte of a){
  c ^= byte;
  for(let k=0;k<8;k++) c=c&1?(c>>>1)^0xedb88320:c>>>1;
 }
 return(c^0xffffffff)>>>0;
}
const write16=(b,o,n)=>b.writeUInt16LE(n,o);
const write32=(b,o,n)=>b.writeUInt32LE(n>>>0,o);
function makeZip(files) {
 const locals=[],central=[];let offset=0;
 for(const {name,data,method=8,flags=0,checksum=crc32(data)} of files){
  const fn=Buffer.from(name,'utf8'), compressed=method===8?deflateRawSync(data):data;
  const local=Buffer.alloc(30);
  write32(local,0,0x04034b50);write16(local,4,20);write16(local,6,flags);
  write16(local,8,method);write32(local,14,checksum);
  write32(local,18,compressed.length);write32(local,22,data.length);write16(local,26,fn.length);
  locals.push(local,fn,compressed);
  const dir=Buffer.alloc(46);
  write32(dir,0,0x02014b50);write16(dir,4,20);write16(dir,6,20);
  write16(dir,8,flags);write16(dir,10,method);write32(dir,16,checksum);
  write32(dir,20,compressed.length);write32(dir,24,data.length);
  write16(dir,28,fn.length);write32(dir,42,offset);
  central.push(dir,fn);
  offset+=local.length+fn.length+compressed.length;
 }
 const centre=Buffer.concat(central),end=Buffer.alloc(22);
 write32(end,0,0x06054b50);write16(end,8,files.length);write16(end,10,files.length);
 write32(end,12,centre.length);write32(end,16,offset);
 return Buffer.concat([...locals,centre,end]);
}
function input(bytes, name='cartridges.zip'){
 return {name,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
}
const file={name:'nested/Pokemon - Red Version (USA, Europe) (SGB Enhanced).gb',data:rom};
const valid=makeZip([file]);
const extracted=await unzip(input(valid));
assert.equal(extracted.name,'Pokemon - Red Version (USA, Europe) (SGB Enhanced).gb');
assert.deepEqual(Buffer.from(extracted.bytes),rom);
const stored=await unzip(input(makeZip([{name:'game.gb',data:rom,method:0}])));
assert.deepEqual(Buffer.from(stored.bytes),rom);
for(const [label,payload,expect] of [
 ['no gb file',makeZip([{name:'readme.txt',data:Buffer.from('hi')}]),/No .gb or .gbc/],
 ['two games',makeZip([{name:'one.gb',data:rom},{name:'two.gb',data:rom}]),/multiple Game Boy/],
 ['traversal',makeZip([{name:'../escaped.gb',data:rom}]),/Unsafe cartridge/],
 ['encryption',makeZip([{name:'x.gb',data:rom,flags:1}]),/Encrypted ZIP/],
 ['too small',makeZip([{name:'x.gb',data:Buffer.alloc(300)}]),/336 bytes/],
 ['checksum',makeZip([{name:'x.gb',data:rom,checksum:0}]),/checksum/],
 ['not zip',Buffer.from('just text'),/between 22 bytes/],
]) {
 await assert.rejects(()=>unzip(input(payload)),expect,label);
}
const page=readFileSync('apps/jhadina-web/public/gaming/gameboy/index.html','utf8');
assert(page.includes('zip-import.js')&&page.includes('.gb,.gbc,.zip'));
assert(page.includes('JhadinaGameBoyZip.extractSingleGameBoyRom(file)'));
console.log('PASS: game ZIP locally extracts licensed 2048 GB fixture, verifies CRC, enforces bounds, blocks unsafe/multiple/encrypted files, never fetches ROM URLs');
