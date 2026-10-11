import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const source=readFileSync(resolve('apps/jhadina-web/public/gaming/gameboy/backup.js'),'utf8');
const context={crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Date,window:{},btoa,atob,console};
createContext(context);
runInContext(source,context,{filename:'backup.js'});
const {encrypt,decrypt}=context.window.JhadinaGameBackup;
const password='a-tested-and-long-unique-passphrase';
const bytes=new Uint8Array([1,2,3,4]);
const hash=createHash('sha256').update(bytes).digest('hex');
const save={key:'gbstate:example',revision:1,payload:{gameId:'example',sha256:hash,bytes,createdAtMs:1}};
const manifest={key:'library:example',revision:1,payload:{id:'example',title:'Test cartridge',platform:'gameboy',contentUri:'gameboy-local://example'}};
const arcade={key:'arcade:neon-run:best',revision:2,payload:{gameId:'neon-run',score:180,achievedAtMs:1}};
const battery={key:'gbram:example',revision:2,payload:{gameId:'example',sha256:hash,bytes,createdAtMs:2}};
const romSha='a'.repeat(64),gameId='gen-'+romSha.slice(0,24);
const segaSram={key:'gensram:'+gameId,revision:3,payload:{
 gameId,romSha,sha256:hash,bytes,format:'jgenesis-sram',updatedAtMs:3
}};
const genesisBytes=new Uint8Array(4096).fill(7);
const genesisHash=createHash('sha256').update(genesisBytes).digest('hex');
const genesisState={key:'genstate:'+gameId,revision:4,payload:{
 gameId,romSha,sha256:genesisHash,bytes:genesisBytes,
 format:'jhadina.sega.jgenesis.save-state.v1',
 sourceCommit:'220421984e710758cb691dcd1dd6a757ae9aca72',
 createdAtMs:42
}};
const archive=await encrypt([manifest,save,arcade,battery,segaSram,genesisState],password);
assert.equal(archive.schema,'jhadina.gaming.encrypted-save-backup.v1');
assert.equal(archive.romsIncluded,false);
assert.equal(archive.cipher,'AES-256-GCM');
const decrypted=await decrypt(archive,password);
assert.equal(decrypted.length,6);
assert.equal(decrypted[5].key,genesisState.key);
assert.equal(decrypted[5].payload.bytes.byteLength,4096);
assert.deepEqual([...decrypted[1].payload.bytes],[1,2,3,4]);
assert.equal(decrypted[1].payload.sha256,hash);
assert.equal(decrypted[2].payload.score,180);
assert.equal(decrypted[3].key,'gbram:example');
assert.deepEqual([...decrypted[3].payload.bytes],[1,2,3,4]);
assert.equal(decrypted[4].key,segaSram.key);
assert.deepEqual([...decrypted[4].payload.bytes],[1,2,3,4]);
await assert.rejects(()=>encrypt([{...arcade,payload:{...arcade.payload,score:-1}}],password),/Invalid arcade/);
await assert.rejects(()=>decrypt(archive,'wrong-long-enough-password'),/Wrong passphrase/);
await assert.rejects(()=>decrypt({...archive,ciphertextSha256:'0'.repeat(64)},password),/digest mismatch/);
await assert.rejects(()=>encrypt([{key:'rom:test',revision:1,payload:{bytes}}],password),/excluded/);
await assert.rejects(()=>encrypt([{...manifest,payload:{...manifest.payload,metadata:{romBytes:bytes}}}],password),/Sensitive|binary/);
await assert.rejects(()=>encrypt([{...manifest,payload:{...manifest.payload,snapshot:bytes}}],password),/binary/);
await assert.rejects(()=>encrypt([{...manifest,payload:{...manifest.payload,credentials:'token'}}],password),/Sensitive/);

await assert.rejects(()=>encrypt([{...segaSram,payload:{...segaSram.payload,romBytes:bytes}}],password),/Sensitive/);
await assert.rejects(()=>encrypt([{...segaSram,payload:{...segaSram.payload,sha256:'0'.repeat(64)}}],password),/digest mismatch/);
await assert.rejects(()=>encrypt([{...segaSram,key:'gensram:gen-other'}],password),/Invalid Sega SRAM/);
await assert.rejects(()=>encrypt([{...genesisState,payload:{...genesisState.payload,romBytes:genesisBytes}}],password),/Sensitive/);
await assert.rejects(()=>encrypt([{...genesisState,payload:{...genesisState.payload,sha256:'0'.repeat(64)}}],password),/digest mismatch/);
await assert.rejects(()=>encrypt([{...genesisState,payload:{...genesisState.payload,sourceCommit:'unreviewed'}}],password),/Invalid Genesis/);
await assert.rejects(()=>encrypt([save], 'weak'),/12 characters/);
console.log('PASS: AES-256-GCM encrypted gaming backup roundtrip, integrity, deny cases and ROM exclusion');
