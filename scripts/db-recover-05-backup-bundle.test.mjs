import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {inspectBackupBundleManifest,verifyLocalBackupBundle} from './db-recover-05-backup-bundle.mjs'
const sha=s=>createHash('sha256').update(s).digest('hex')
const parts={roles:'-- generated roles fixture\n',schema:'-- schema fixture\n',data:'-- data fixture\n'}
const manifest=()=>({version:1,sourceProjectId:'kqbkaozfjubkjevdfvic',
 method:'SUPABASE_CLI_TRIPLE_SQL',capturedAt:'2026-10-15T04:00:00Z',
 files:Object.fromEntries(Object.entries(parts).map(([key,bytes])=>[key,{name:key+'.sql',sha256:sha(bytes),bytes:Buffer.byteLength(bytes)}]))})
test('a local three-file byte match never certifies a real source backup or restore',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'db-recover-05-'))
 try{
  for(const [key,value] of Object.entries(parts))await writeFile(join(dir,key+'.sql'),value)
  const result=await verifyLocalBackupBundle(manifest(),dir)
  assert.equal(result.status,'BUNDLE_BYTES_MATCH_UNVERIFIED_SOURCE')
  assert.equal(result.files.length,3);assert.equal(result.sourceIndependentlyVerified,false)
  assert.equal(result.isolatedRestoreVerified,false);assert.equal(result.canApplyProductionSql,false)
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('invalid source ID or archive method is rejected',()=>{
 assert.throws(()=>inspectBackupBundleManifest({...manifest(),sourceProjectId:'someone-else'}),/MANIFEST_INVALID/)
 assert.throws(()=>inspectBackupBundleManifest({...manifest(),method:'SYNTHETIC_CANARY'}),/MANIFEST_INVALID/)
})
test('tampered file contents cannot pass SHA-256 or length preflight',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'db-recover-05-'))
 try{
  for(const [key,value] of Object.entries(parts))await writeFile(join(dir,key+'.sql'),value)
  await writeFile(join(dir,'data.sql'),parts.data.replace('fixture','ficture'))
  await assert.rejects(verifyLocalBackupBundle(manifest(),dir),/HASH_OR_LENGTH_MISMATCH:data/)
 }finally{await rm(dir,{recursive:true,force:true})}
})
test('symlinked backup artifacts are rejected even when target SHA matches',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'db-recover-05-'))
 try{
  for(const [key,value] of Object.entries(parts))await writeFile(join(dir,key+'.sql'),value)
  await writeFile(join(dir,'outside.sql'),parts.roles)
  await rm(join(dir,'roles.sql'))
  await symlink(join(dir,'outside.sql'),join(dir,'roles.sql'))
  await assert.rejects(verifyLocalBackupBundle(manifest(),dir),/SYMLINK_OR_SPECIAL_FILE_REJECTED/)
 }finally{await rm(dir,{recursive:true,force:true})}
})
