/* Jhadina Sega Genesis / Mega Drive owner-local cartridge admission.
 * No ROM upload, CDN, game execution, BIOS or firmware. Reject archives before extraction.
 */
(function(root){
'use strict';
const MAX_ROM=16*1024*1024,MAX_ZIP=24*1024*1024,MAX_ENTRIES=64;
function fail(message){throw new Error(message)}
function requireValid(test,message){if(!test)fail(message)}
function u16(b,o){requireValid(o>=0&&o+2<=b.length,'Truncated ZIP');return b[o]|b[o+1]<<8}
function u32(b,o){requireValid(o>=0&&o+4<=b.length,'Truncated ZIP');return (b[o]+b[o+1]*256+b[o+2]*65536+b[o+3]*16777216)>>>0}
const table=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0}
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function safeName(name){return name.length<=512&&!name.includes('\0')&&!name.startsWith('/')&&!name.startsWith('\\')&&!/^[A-Za-z]:/.test(name)&&!name.split(/[\\/]/).some(v=>v===''||v==='..')}
function isGenesisName(name){return /\.(md|gen|bin)$/i.test(name)}
function readAscii(b,start,end){return String.fromCharCode(...b.subarray(start,end)).replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim()}
function inspect(bytes){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 requireValid(b.length>=0x200&&b.length<=MAX_ROM&&b.length%2===0,'Genesis cartridge size must be 512 bytes to 16 MB and even');
 requireValid(readAscii(b,0x100,0x110).startsWith('SEGA'),'Genesis header missing at offset 0x100');
 const title=readAscii(b,0x150,0x180)||readAscii(b,0x120,0x150)||'Untitled Genesis cartridge';
 return {platform:'genesis',console:readAscii(b,0x100,0x110),title:title.slice(0,80),
  region:readAscii(b,0x1f0,0x200).slice(0,16),size:b.length};
}
async function decompress(data,expected){
 requireValid(typeof DecompressionStream==='function','ZIP decompression unavailable in this browser. Extract the .md file using Files.');
 let reader;
 try{reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()}
 catch{fail('ZIP compression unsupported here. Extract the .md file using Files.')}
 const output=new Uint8Array(expected);let size=0;
 try{while(true){const chunk=await reader.read();if(chunk.done)break;
  requireValid(chunk.value&&size+chunk.value.length<=expected,'ZIP expansion exceeded declared size');
  output.set(chunk.value,size);size+=chunk.value.length;
 }}catch(e){try{await reader.cancel()}catch{}throw e}finally{try{reader.releaseLock()}catch{}}
 requireValid(size===expected,'ZIP extracted size mismatch');
 return output;
}
async function extractZip(file){
 requireValid(file.size>=22&&file.size<=MAX_ZIP,'ZIP must be between 22 bytes and 24 MB');
 const b=new Uint8Array(await file.arrayBuffer());
 requireValid(b.length===file.size,'ZIP changed during import');
 let eocd=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)
  if(u32(b,i)===0x06054b50&&i+22+u16(b,i+20)===b.length){eocd=i;break}
 requireValid(eocd>=0,'ZIP directory missing');
 requireValid(u16(b,eocd+4)===0&&u16(b,eocd+6)===0,'Multi-disk ZIP unsupported');
 const count=u16(b,eocd+10),start=u32(b,eocd+16),length=u32(b,eocd+12);
 requireValid(count>0&&count<=MAX_ENTRIES&&count===u16(b,eocd+8),'ZIP entry count invalid');
 requireValid(start!==0xffffffff&&length!==0xffffffff&&start+length===eocd,'ZIP directory layout invalid');
 let offset=start,entry=null;
 for(let i=0;i<count;i++){
  requireValid(offset+46<=eocd&&u32(b,offset)===0x02014b50,'Invalid ZIP entry');
  const flags=u16(b,offset+8),method=u16(b,offset+10),crc=u32(b,offset+16);
  const compressed=u32(b,offset+20),uncompressed=u32(b,offset+24);
  const nameLen=u16(b,offset+28),extra=u16(b,offset+30),comment=u16(b,offset+32),local=u32(b,offset+42);
  const next=offset+46+nameLen+extra+comment;
  requireValid(next<=eocd&&nameLen<=512,'Invalid ZIP entry filename');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(offset+46,offset+46+nameLen));
  if(isGenesisName(name)){
   requireValid(!entry,'ZIP contains multiple Sega cartridges; select one separately');
   requireValid(safeName(name),'Unsafe cartridge path in ZIP');
   requireValid(!(flags&1)&&!(flags&64),'Encrypted ZIP unsupported');
   requireValid(method===0||method===8,'ZIP compression unsupported');
   requireValid(uncompressed>=0x200&&uncompressed<=MAX_ROM&&compressed<=MAX_ZIP,'ZIP cartridge size invalid');
   requireValid(local+30<=start&&u32(b,local)===0x04034b50,'Invalid local ZIP entry');
   requireValid(u16(b,local+8)===method&&u16(b,local+6)===flags,'ZIP metadata mismatch');
   const localNameLen=u16(b,local+26),localExtra=u16(b,local+28);
   requireValid(localNameLen===nameLen&&local+30+localNameLen+localExtra<=start,'ZIP local filename invalid');
   const localName=b.subarray(local+30,local+30+localNameLen);
   const centralName=b.subarray(offset+46,offset+46+nameLen);
   requireValid(localName.every((v,j)=>v===centralName[j]),'ZIP filename disagreement');
   const dataStart=local+30+localNameLen+localExtra;
   requireValid(dataStart+compressed<=start,'ZIP compressed data extends beyond directory');
   entry={name:name.split(/[\\/]/).pop(),method,crc,uncompressed,data:b.subarray(dataStart,dataStart+compressed)};
  }
  offset=next;
 }
 requireValid(offset===eocd&&entry,'ZIP contains no supported .md, .gen or .bin cartridge');
 const bytes=entry.method===0?entry.data.slice():await decompress(entry.data,entry.uncompressed);
 requireValid(bytes.length===entry.uncompressed&&crc32(bytes)===entry.crc,'ZIP CRC check failed');
 return {name:entry.name,bytes};
}
async function importCartridge(file){
 requireValid(file&&typeof file.name==='string','Choose a Sega cartridge file');
 requireValid(!/\.smd$/i.test(file.name),'Interleaved .smd format is not yet supported');
 let extracted;
 if(/\.zip$/i.test(file.name))extracted=await extractZip(file);
 else{
  requireValid(isGenesisName(file.name),'Choose one .md, .gen, .bin or .zip file');
  requireValid(file.size>=0x200&&file.size<=MAX_ROM,'Sega cartridge file size invalid');
  extracted={name:file.name,bytes:new Uint8Array(await file.arrayBuffer())};
 }
 const metadata=inspect(extracted.bytes);
 requireValid(root.crypto&&root.crypto.subtle,'Secure browser hashing unavailable');
 const hashed=await root.crypto.subtle.digest('SHA-256',extracted.bytes);
 const sha256=Array.from(new Uint8Array(hashed),x=>x.toString(16).padStart(2,'0')).join('');
 return {...metadata,name:extracted.name,sha256,bytes:extracted.bytes};
}
root.JhadinaSegaCartridge=Object.freeze({inspect,importCartridge,crc32});
})(globalThis);
