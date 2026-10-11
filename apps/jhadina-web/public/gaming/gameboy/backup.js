/* Offline encrypted backups. Never send ROM bytes or passphrases to a service. */
(function(global){
'use strict';
const SCHEMA='jhadina.gaming.encrypted-save-backup.v1';
const INNER='jhadina.gaming.save-payload.v1';
const ITERATIONS=310000;
const LIMIT=48*1024*1024;
const TYPES=['library:','gbstate:','save:','session:','observation:','route:','arcade:'];
const encoder=new TextEncoder(),decoder=new TextDecoder();
function requirePassword(password){
 if(typeof password!=='string'||password.length<12)throw new Error('Choose a backup passphrase with at least 12 characters');
}
function toBase64(data){
 const bytes=new Uint8Array(data.buffer??data,data.byteOffset??0,data.byteLength);
 let out='';
 for(let i=0;i<bytes.length;i+=16384)out+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return btoa(out);
}
function fromBase64(value){
 if(typeof value!=='string'||value.length>LIMIT*2||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))
  throw new Error('Malformed backup binary data');
 const raw=atob(value),result=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)result[i]=raw.charCodeAt(i);
 return result;
}
async function hash(bytes){
 const result=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(result),v=>v.toString(16).padStart(2,'0')).join('');
}
async function secret(password,salt){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function encodeRecords(records){
 return JSON.stringify({schema:INNER,records},(_key,value)=>value instanceof Uint8Array
  ?{__bytesB64:toBase64(value)}:value);
}
function assertNoUnapprovedBinaries(payload,saveState){
 const visit=(value,path,depth)=>{
  if(depth>18)throw new Error('Gaming backup nesting limit exceeded');
  if(value instanceof Uint8Array){
   if(!saveState||path!=='bytes')throw new Error('ROMs and arbitrary binary attachments cannot enter game backups');
   return;
  }
  if(value instanceof ArrayBuffer||ArrayBuffer.isView(value))
   throw new Error('Unapproved binary object in game backup');
  if(value&&typeof value==='object'){
   for(const [key,child] of Object.entries(value)){
    if(['__proto__','prototype','constructor'].includes(key)
       ||/^(romBytes|biosBytes|firmwareBytes|accessToken|refreshToken|oauthToken|credential|credentials|secret)$/i.test(key))
      throw new Error('Sensitive or executable content is excluded from backup');
    visit(child,path?path+'.'+key:key,depth+1);
   }
  }
 };
 visit(payload,'',0);
}
function decodeRecords(text){
 const obj=JSON.parse(text,(_key,value)=>{
  if(value&&typeof value==='object'&&typeof value.__bytesB64==='string'
     &&Object.keys(value).length===1)return fromBase64(value.__bytesB64);
  return value;
 });
 if(obj?.schema!==INNER||!Array.isArray(obj.records)||obj.records.length>5000)
  throw new Error('Unsupported or oversized backup payload');
 const seen=new Set();
 for(const record of obj.records){
  if(!record||typeof record.key!=='string'||!TYPES.some(x=>record.key.startsWith(x))
     ||record.key.length>400||record.key.includes('..')||!Number.isSafeInteger(record.revision)
     ||record.revision<1||typeof record.payload!=='object'||!record.payload)
   throw new Error('Backup contains an invalid record');
  if(seen.has(record.key))throw new Error('Duplicate backup record');
  seen.add(record.key);
  assertNoUnapprovedBinaries(record.payload,record.key.startsWith('gbstate:'));
  if(record.key.startsWith('library:')){
   const item=record.payload;
   if(typeof item.id!=='string'||!item.id.trim()
      ||typeof item.title!=='string'||!item.title.trim()
      ||typeof item.platform!=='string'||typeof item.contentUri!=='string')
    throw new Error('Invalid game library record');
  }
  if(record.key.startsWith('arcade:')){
   const value=record.payload;
   if(typeof value.gameId!=='string'||!value.gameId.trim()
      ||!Number.isFinite(value.score)||value.score<0||!Number.isFinite(value.achievedAtMs))
     throw new Error('Invalid arcade score record');
  }
  if(record.key.startsWith('gbstate:')){
   if(!(record.payload.bytes instanceof Uint8Array)||!record.payload.bytes.byteLength||record.payload.bytes.byteLength>8*1024*1024
      ||!/^[a-f0-9]{64}$/.test(record.payload.sha256||''))throw new Error('Invalid Game Boy save-state record');
  }
 }
 return obj.records;
}
async function validateStates(records){
 for(const record of records){
  if(record.key.startsWith('gbstate:')&&await hash(record.payload.bytes)!==record.payload.sha256)
   throw new Error('Save-state digest mismatch');
 }
}
async function encrypt(records,password){
 requirePassword(password);
 if(!Array.isArray(records)||records.some(r=>typeof r?.key!=='string'||!TYPES.some(x=>r.key.startsWith(x))))
  throw new Error('Only save/library/history records may be included; ROM bytes are excluded');
 const plaintext=encoder.encode(encodeRecords(records));
 if(plaintext.byteLength>LIMIT)throw new Error('Backup exceeds local encryption limit');
 decodeRecords(decoder.decode(plaintext));
 await validateStates(records);
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await secret(password,salt);
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plaintext));
 return{
  schema:SCHEMA,createdAtMs:Date.now(),recordCount:records.length,romsIncluded:false,
  kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',
  salt:toBase64(salt),iv:toBase64(iv),
  ciphertextSha256:await hash(ciphertext),ciphertext:toBase64(ciphertext),
 };
}
async function decrypt(archive,password){
 requirePassword(password);
 if(!archive||archive.schema!==SCHEMA||archive.romsIncluded!==false
   ||archive.kdf!=='PBKDF2-SHA256'||archive.iterations!==ITERATIONS||archive.cipher!=='AES-256-GCM'
   ||!/^[a-f0-9]{64}$/.test(archive.ciphertextSha256||''))
  throw new Error('Unsupported encrypted backup format');
 const salt=fromBase64(archive.salt),iv=fromBase64(archive.iv),bytes=fromBase64(archive.ciphertext);
 if(salt.byteLength!==16||iv.byteLength!==12||bytes.byteLength>LIMIT+16)
  throw new Error('Invalid encrypted backup parameters');
 if(await hash(bytes)!==archive.ciphertextSha256)throw new Error('Encrypted backup digest mismatch');
 const key=await secret(password,salt);
 let plaintext;
 try{plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,bytes);}
 catch{throw new Error('Wrong passphrase or damaged backup');}
 const records=decodeRecords(decoder.decode(plaintext));
 if(records.length!==archive.recordCount)throw new Error('Backup record count mismatch');
 await validateStates(records);
 return records;
}
global.JhadinaGameBackup=Object.freeze({encrypt,decrypt});
})(window);
